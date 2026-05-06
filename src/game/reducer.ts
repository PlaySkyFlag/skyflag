import {
  ACTIVATIONS_PER_TURN,
  DEPLOY_COORDS,
  FLAG_COORDS,
  LIFT_CELLS,
  createInitialGameState,
} from './constants';
import { legalMovesFor, pieceAt, sameCoord } from './moves';
import type { BoardPiece, Coord, FlagsState, GameState, Piece, PieceId, Player } from './types';
import { opponentOf } from './types';

export type Action =
  | { type: 'deploy'; pieceId: PieceId }
  | { type: 'move'; pieceId: PieceId; to: Coord }
  | { type: 'end-turn' }
  | { type: 'new-game' };

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
  }
}

function isOccupied(state: GameState, c: Coord): boolean {
  return pieceAt(state, c) !== undefined;
}

function isLiftCell(c: Coord): boolean {
  return LIFT_CELLS.some((lc) => lc.row === c.row && lc.col === c.col);
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

  const next: GameState = {
    ...state,
    inHand: { ...state.inHand, [player]: newHand },
    onBoard: [
      ...state.onBoard,
      { piece, coord: deployCoord, arrivedOnLiftThisTurn: false },
    ],
    activationsRemaining: state.activationsRemaining - 1,
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
    arrivedOnLiftThisTurn: isLiftCell(to),
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

  const next: GameState = {
    ...state,
    onBoard: newOnBoard,
    captured: newCaptured,
    flags: newFlags,
    activationsRemaining: state.activationsRemaining - 1,
  };

  return next.activationsRemaining > 0 ? next : passInitiative(next);
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
  return passInitiative(state);
}

function passInitiative(state: GameState): GameState {
  return {
    ...state,
    onBoard: state.onBoard.map((bp) =>
      bp.arrivedOnLiftThisTurn ? { ...bp, arrivedOnLiftThisTurn: false } : bp,
    ),
    currentPlayer: opponentOf(state.currentPlayer),
    activationsRemaining: ACTIVATIONS_PER_TURN,
    turnNumber: state.turnNumber + 1,
  };
}
