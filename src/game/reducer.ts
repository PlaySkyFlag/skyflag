import {
  ACTIVATIONS_PER_TURN,
  DEPLOY_COORDS,
  FLAG_COORDS,
  LIFT_CELLS,
  createInitialGameState,
} from './constants';
import { legalMovesFor, pieceAt, sameCoord } from './moves';
import type { BoardPiece, Coord, FlagsState, GameState, PieceId } from './types';
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

  const movedPiece: BoardPiece = {
    ...moving,
    coord: to,
    arrivedOnLiftThisTurn: isLiftCell(to),
  };

  const newOnBoard: BoardPiece[] = [];
  for (let i = 0; i < state.onBoard.length; i++) {
    if (i === captureIdx) continue;
    newOnBoard.push(i === movingIdx ? movedPiece : state.onBoard[i]);
  }

  // Flag capture (rulebook turn step 3): only Captains capture flags, by
  // landing on the opponent's flag cell. Free side-effect, no extra activation.
  const newFlags = maybeCaptureFlag(state.flags, moving.piece.kind, state.currentPlayer, to);

  const next: GameState = {
    ...state,
    onBoard: newOnBoard,
    flags: newFlags,
    activationsRemaining: state.activationsRemaining - 1,
  };

  return next.activationsRemaining > 0 ? next : passInitiative(next);
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
