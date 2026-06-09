import {
  ACTIVATIONS_PER_TURN,
  DEPLOY_COORDS,
  FLAG_COORDS,
  NEXUS_COORD,
  TURN_LIMIT,
  createInitialGameState,
} from './constants';
import { legalMovesFor, pieceAt, sameCoord } from './moves';
import type {
  BoardPiece,
  ClockState,
  Coord,
  FlagsState,
  GameState,
  HistoryEntry,
  Piece,
  PieceId,
  Player,
} from './types';
import { opponentOf } from './types';

export type Action =
  | { type: 'deploy'; pieceId: PieceId }
  | { type: 'move'; pieceId: PieceId; to: Coord }
  | { type: 'end-turn' }
  // new-game can carry an optional clock duration in ms — when > 0 the
  // initial state ships with `clock` populated and the App-level
  // tick effect will start running it on first turn.
  | { type: 'new-game'; clockMs?: number }
  // Resign: ends the game with the resigner's opponent winning by
  // resignation. Always dispatched by the resigning side (current
  // player) for the local hot-seat / 1P case; in MP either side can
  // resign at any time.
  | { type: 'resign'; player: Player }
  // Both players have agreed to a draw — end the game with reason
  // 'agreement'. Caller is responsible for the agreement-handshake
  // (1P/2P: confirm dialog; MP: offer + accept broadcast).
  | { type: 'agree-draw' }
  // Charge the active player real elapsed wall-clock time since the
  // last tick. App passes Date.now(); reducer subtracts the lag from
  // the player's remaining ms. Transitions to 'won' with reason
  // 'time-out' if the active player's clock hits zero.
  | { type: 'tick-clock'; now: number }
  // Replace the entire state — used by the multiplayer realtime sync to
  // adopt an opponent's authoritative state without re-running rules.
  | { type: 'remote-sync'; state: GameState };

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'new-game':
      return createInitialGameState(action.clockMs);
    case 'deploy':
      return applyDeploy(state, action.pieceId);
    case 'move':
      return applyMove(state, action.pieceId, action.to);
    case 'end-turn':
      return applyEndTurn(state);
    case 'resign':
      return applyResign(state, action.player);
    case 'agree-draw':
      return applyDrawAgreement(state);
    case 'tick-clock':
      return applyTick(state, action.now);
    case 'remote-sync':
      return action.state;
  }
}

function isOccupied(state: GameState, c: Coord): boolean {
  return pieceAt(state, c) !== undefined;
}

function applyDeploy(state: GameState, pieceId: PieceId): GameState {
  if (state.status.kind !== 'in-progress') return state;
  if (state.activationsRemaining <= 0) return state;

  const player = state.currentPlayer;
  const hand = state.inHand[player];
  const idx = hand.findIndex((p) => p.id === pieceId);
  if (idx < 0) return state;

  const deployCoord = DEPLOY_COORDS[player];
  if (isOccupied(state, deployCoord)) return state;

  const piece = hand[idx];
  const newHand = [...hand.slice(0, idx), ...hand.slice(idx + 1)];

  const entry: HistoryEntry = {
    kind: 'deploy',
    turn: state.turnNumber,
    player,
    pieceKind: piece.kind,
    coord: deployCoord,
  };

  const next: GameState = {
    ...state,
    inHand: { ...state.inHand, [player]: newHand },
    onBoard: [
      ...state.onBoard,
      { piece, coord: deployCoord },
    ],
    activationsRemaining: state.activationsRemaining - 1,
    history: [...state.history, entry],
  };

  return next.activationsRemaining > 0 ? next : passInitiative(next);
}

function applyMove(state: GameState, pieceId: PieceId, to: Coord): GameState {
  if (state.status.kind !== 'in-progress') return state;
  if (state.activationsRemaining <= 0) return state;

  const movingIdx = state.onBoard.findIndex((bp) => bp.piece.id === pieceId);
  if (movingIdx < 0) return state;

  const moving = state.onBoard[movingIdx];
  if (moving.piece.owner !== state.currentPlayer) return state;

  const legal = legalMovesFor(moving, state);
  if (!legal.some((c) => sameCoord(c, to))) return state;

  // Compute every onBoard index that's captured by this move:
  //   • destination piece if it's an opponent (capture by landing)
  //   • for Pilot 2-sq diagonal moves: the intermediate piece if it's an
  //     opponent ("jumped piece is captured"). Friendly pieces may be jumped
  //     over but are never captured.
  const captureIndices = capturesFor(state, movingIdx, moving, to);

  const newPiece = nextPieceState(moving.piece, to);
  const movedPiece: BoardPiece = {
    piece: newPiece,
    coord: to,
  };

  const captureSet = new Set(captureIndices);
  const newOnBoard: BoardPiece[] = [];
  for (let i = 0; i < state.onBoard.length; i++) {
    if (captureSet.has(i)) continue;
    newOnBoard.push(i === movingIdx ? movedPiece : state.onBoard[i]);
  }

  // Record each captured piece in the loser's captured list.
  let newCaptured: Record<Player, Piece[]> = state.captured;
  for (const idx of captureIndices) {
    const lost = state.onBoard[idx].piece;
    const loser = lost.owner;
    newCaptured = {
      ...newCaptured,
      [loser]: [...newCaptured[loser], lost],
    };
  }

  // Flag capture (rulebook turn step 3): runs AFTER any promotion so a Soldier
  // that promotes by reaching the far row (on any layer) can capture a flag on
  // that square in the same activation. Only Captains capture flags.
  const newFlags = maybeCaptureFlag(state.flags, newPiece.kind, state.currentPlayer, to);

  // Record the move for the history log. Capture and promotion details are
  // attached so the log has enough context to render meaningfully later.
  const captured = captureIndices.length
    ? {
        kind: state.onBoard[captureIndices[0]].piece.kind,
        owner: state.onBoard[captureIndices[0]].piece.owner,
      }
    : undefined;
  const promoted = moving.piece.kind === 'soldier' && newPiece.kind === 'captain';
  const flagCapturedNow = (Object.keys(newFlags) as Array<keyof FlagsState>).find(
    (layer) => {
      const opp = opponentOf(state.currentPlayer);
      return newFlags[layer][opp] && !state.flags[layer][opp];
    },
  );
  const flagCaptured = flagCapturedNow
    ? { layer: flagCapturedNow, owner: opponentOf(state.currentPlayer) }
    : undefined;
  const entry: HistoryEntry = {
    kind: 'move',
    turn: state.turnNumber,
    player: state.currentPlayer,
    pieceKind: moving.piece.kind,
    from: moving.coord,
    to,
    ...(captured ? { captured } : {}),
    ...(promoted ? { promoted: true } : {}),
    ...(flagCaptured ? { flagCaptured } : {}),
  };

  const next: GameState = {
    ...state,
    onBoard: newOnBoard,
    captured: newCaptured,
    flags: newFlags,
    activationsRemaining: state.activationsRemaining - 1,
    history: [...state.history, entry],
  };

  // Win checks happen after the move's effects are settled. Nexus first
  // (rulebook turn step 4), then elimination. If either fires we skip
  // passInitiative — game is over.
  if (isNexusWin(next, newPiece, to)) {
    return {
      ...next,
      status: { kind: 'won', winner: state.currentPlayer, reason: 'nexus' },
    };
  }
  if (isEliminated(next, opponentOf(state.currentPlayer))) {
    return {
      ...next,
      status: { kind: 'won', winner: state.currentPlayer, reason: 'elimination' },
    };
  }

  return next.activationsRemaining > 0 ? next : passInitiative(next);
}

// Nexus win: post-promotion piece is a Captain landing on Space(3,3) with
// all three of the opponent's flags already captured.
function isNexusWin(state: GameState, movingPiece: Piece, to: Coord): boolean {
  if (movingPiece.kind !== 'captain') return false;
  if (to.layer !== NEXUS_COORD.layer || to.row !== NEXUS_COORD.row || to.col !== NEXUS_COORD.col) {
    return false;
  }
  const opp = opponentOf(movingPiece.owner);
  return state.flags.ground[opp] && state.flags.sky[opp] && state.flags.space[opp];
}

// Elimination: a player has no Captain-capable pieces (Captains, original or
// promoted, plus Soldiers — which can promote) anywhere — neither in hand nor
// on the board.
function isEliminated(state: GameState, player: Player): boolean {
  const hasInHand = state.inHand[player].some(
    (p) => p.kind === 'captain' || p.kind === 'soldier',
  );
  if (hasInHand) return false;
  const hasOnBoard = state.onBoard.some(
    (bp) =>
      bp.piece.owner === player &&
      (bp.piece.kind === 'captain' || bp.piece.kind === 'soldier'),
  );
  return !hasOnBoard;
}

// Indices of all onBoard pieces removed by this move. Today every piece type
// can capture only the destination piece (if it's an opponent). The list shape
// leaves room for future multi-capture rules without further refactoring.
function capturesFor(
  state: GameState,
  movingIdx: number,
  moving: BoardPiece,
  to: Coord,
): number[] {
  const captures: number[] = [];

  const destIdx = state.onBoard.findIndex(
    (bp, i) => i !== movingIdx && sameCoord(bp.coord, to),
  );
  if (destIdx >= 0 && state.onBoard[destIdx].piece.owner !== moving.piece.owner) {
    captures.push(destIdx);
  }

  return captures;
}

// Apply any same-activation transformations to a piece that just moved to `to`:
//   • Soldier → Captain promotion when reaching the far row on ANY layer.
//   • Soldier hasMoved flag flips to true after its first move.
// Captain / Rover / Pilot pass through unchanged.
function nextPieceState(piece: Piece, to: Coord): Piece {
  if (piece.kind !== 'soldier') return piece;
  if (isPromotionRow(piece.owner, to.row)) {
    return {
      id: piece.id,
      owner: piece.owner,
      kind: 'captain',
      promotedFromSoldier: true,
    };
  }
  return piece.hasMoved ? piece : { ...piece, hasMoved: true };
}

function isPromotionRow(owner: Player, row: number): boolean {
  return (owner === 'p1' && row === 5) || (owner === 'p2' && row === 0);
}

// Charge the active player real wall-clock time since the previous
// tick. First tick after a new game / turn change just records `now`
// without charging (lastTickAt was null). If the active player's clock
// hits zero, the OPPONENT wins by 'time-out'. No-op when no clock is
// configured or the game has already ended.
function applyTick(state: GameState, now: number): GameState {
  if (!state.clock) return state;
  if (state.status.kind !== 'in-progress') return state;

  const cur = state.currentPlayer;
  const lastTickAt = state.clock.lastTickAt;

  // First tick after start / turn change — no charge yet, just anchor
  // the timestamp so subsequent ticks have a baseline.
  if (lastTickAt === null) {
    return { ...state, clock: { ...state.clock, lastTickAt: now } };
  }

  const delta = Math.max(0, now - lastTickAt);
  const remaining = (cur === 'p1' ? state.clock.p1Ms : state.clock.p2Ms) - delta;

  if (remaining <= 0) {
    const newClock: ClockState = { ...state.clock, lastTickAt: null };
    if (cur === 'p1') newClock.p1Ms = 0;
    else newClock.p2Ms = 0;
    return {
      ...state,
      clock: newClock,
      status: {
        kind: 'won',
        winner: cur === 'p1' ? 'p2' : 'p1',
        reason: 'time-out',
      },
    };
  }

  const newClock: ClockState = { ...state.clock, lastTickAt: now };
  if (cur === 'p1') newClock.p1Ms = remaining;
  else newClock.p2Ms = remaining;
  return { ...state, clock: newClock };
}

function maybeCaptureFlag(
  flags: FlagsState,
  movingKind: BoardPiece['piece']['kind'],
  capturingPlayer: GameState['currentPlayer'],
  to: Coord,
): FlagsState {
  if (movingKind !== 'captain') return flags;
  const opponent = opponentOf(capturingPlayer);
  const opponentFlagPos = FLAG_COORDS[opponent][to.layer];
  if (to.row !== opponentFlagPos.row || to.col !== opponentFlagPos.col) return flags;
  if (flags[to.layer][opponent]) return flags; // already captured
  return {
    ...flags,
    [to.layer]: { ...flags[to.layer], [opponent]: true },
  };
}

function applyResign(state: GameState, resigner: Player): GameState {
  if (state.status.kind !== 'in-progress') return state;
  return {
    ...state,
    status: { kind: 'won', winner: opponentOf(resigner), reason: 'resignation' },
  };
}

function applyDrawAgreement(state: GameState): GameState {
  if (state.status.kind !== 'in-progress') return state;
  return {
    ...state,
    status: { kind: 'draw', reason: 'agreement' },
  };
}

function applyEndTurn(state: GameState): GameState {
  if (state.status.kind !== 'in-progress') return state;
  const entry: HistoryEntry = {
    kind: 'end-turn',
    turn: state.turnNumber,
    player: state.currentPlayer,
  };
  return passInitiative({
    ...state,
    history: [...state.history, entry],
  });
}

// True if `player` has at least one legal action available right now —
// either a deploy (hand piece + free pad) or any movable on-board piece.
// Used by passInitiative for the stalemate / no-progress checks.
function canActAt(state: GameState, player: Player): boolean {
  if (
    state.inHand[player].length > 0 &&
    !isOccupied(state, DEPLOY_COORDS[player])
  ) {
    return true;
  }
  for (const bp of state.onBoard) {
    if (bp.piece.owner !== player) continue;
    if (legalMovesFor(bp, state).length > 0) return true;
  }
  return false;
}

function passInitiative(state: GameState): GameState {
  const nextTurn = state.turnNumber + 1;
  // Turn-limit draw: 180 turns without a win → game ends. Tiebreakers from
  // rulebook section 7 (flags → pieces → captures → highest layer → Captain
  // Chebyshev distance to Space(3,3)) are deferred — for now this is a flat
  // draw.
  if (nextTurn > TURN_LIMIT) {
    return {
      ...state,
      status: { kind: 'draw', reason: 'turn-limit' },
    };
  }
  const next: GameState = {
    ...state,
    currentPlayer: opponentOf(state.currentPlayer),
    activationsRemaining: ACTIVATIONS_PER_TURN,
    turnNumber: nextTurn,
    // Re-anchor the clock for the new active player so the next tick
    // charges only time spent on THEIR turn — without this, the slice
    // of time between the previous player's last tick and the
    // turn-change action would get wrongly billed to the new side.
    ...(state.clock ? { clock: { ...state.clock, lastTickAt: null } } : {}),
  };
  // Elimination: opponent (the side whose turn just started) has no
  // Captain-capable pieces anywhere — neither in hand nor on board. This
  // covers the user's case B ("no pieces can enter board, game over") for
  // anyone whose hand is empty AND whose remaining on-board pieces are
  // all rovers/pilots (no Captain to win, no Soldier to promote).
  if (isEliminated(next, next.currentPlayer)) {
    return {
      ...next,
      status: { kind: 'won', winner: state.currentPlayer, reason: 'elimination' },
    };
  }
  // Stalemate: neither side can take any action. Without this the auto-
  // end-turn loop would just bounce the (empty) turn back and forth
  // forever until the turn-limit timed out. Detect it eagerly and draw.
  if (!canActAt(next, 'p1') && !canActAt(next, 'p2')) {
    return {
      ...next,
      status: { kind: 'draw', reason: 'stalemate' },
    };
  }
  return next;
}
