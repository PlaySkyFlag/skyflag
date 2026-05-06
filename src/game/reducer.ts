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

  // Capture: opponent piece at destination is removed (legalMovesFor already
  // ensures we never land on a friendly piece).
  const captureIdx = state.onBoard.findIndex(
    (bp, i) => i !== movingIdx && sameCoord(bp.coord, to),
  );

  const newPiece = nextPieceState(moving.piece, to);
  const movedPiece: BoardPiece = {
    piece: newPiece,
    coord: to,
    arrivedOnLiftThisTurn: isLiftCell(to),
  };

  const newOnBoard: BoardPiece[] = [];
  for (let i = 0; i < state.onBoard.length; i++) {
    if (i === captureIdx) continue;
    newOnBoard.push(i === movingIdx ? movedPiece : state.onBoard[i]);
  }

  // Flag capture (rulebook turn step 3): runs AFTER any promotion so a Soldier
  // that promotes by reaching G(5,5)/G(0,0) can capture the opponent's Ground
  // flag in the same activation. Only Captains capture flags.
  const newFlags = maybeCaptureFlag(state.flags, newPiece.kind, state.currentPlayer, to);

  const next: GameState = {
    ...state,
    onBoard: newOnBoard,
    flags: newFlags,
    activationsRemaining: state.activationsRemaining - 1,
  };

  return next.activationsRemaining > 0 ? next : passInitiative(next);
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
