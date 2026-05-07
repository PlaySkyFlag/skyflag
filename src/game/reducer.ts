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
  | { type: 'new-game' }
  // Replace the entire state — used by the multiplayer realtime sync to
  // adopt an opponent's authoritative state without re-running rules.
  | { type: 'remote-sync'; state: GameState };

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'new-game':
      return createInitialGameState();
    case 'deploy':
      return applyDeploy(state, action.pieceId);
    case 'move':
      return applyMove(state, action.pieceId, action.to);
    case 'end-turn':
      return applyEndTurn(state);
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
  // that promotes by reaching G(5,5)/G(0,0) can capture the opponent's Ground
  // flag in the same activation. Only Captains capture flags.
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
//   • Soldier → Captain promotion when reaching the far row on Ground.
//   • Soldier hasMoved flag flips to true after its first move.
// Captain / Rover / Pilot pass through unchanged.
function nextPieceState(piece: Piece, to: Coord): Piece {
  if (piece.kind !== 'soldier') return piece;
  if (to.layer === 'ground' && isPromotionRow(piece.owner, to.row)) {
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
  return {
    ...state,
    currentPlayer: opponentOf(state.currentPlayer),
    activationsRemaining: ACTIVATIONS_PER_TURN,
    turnNumber: nextTurn,
  };
}
