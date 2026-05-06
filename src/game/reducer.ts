import { ACTIVATIONS_PER_TURN, DEPLOY_COORDS, createInitialGameState } from './constants';
import type { Coord, GameState, PieceId } from './types';
import { opponentOf } from './types';

export type Action =
  | { type: 'deploy'; pieceId: PieceId }
  | { type: 'end-turn' }
  | { type: 'new-game' };

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'new-game':
      return createInitialGameState();
    case 'deploy':
      return applyDeploy(state, action.pieceId);
    case 'end-turn':
      return applyEndTurn(state);
  }
}

function isOccupied(state: GameState, c: Coord): boolean {
  return state.onBoard.some(
    (bp) => bp.coord.layer === c.layer && bp.coord.row === c.row && bp.coord.col === c.col,
  );
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

function applyEndTurn(state: GameState): GameState {
  if (state.status.kind !== 'in-progress') return state;
  return passInitiative(state);
}

// End the current player's turn: reset arrivedOnLiftThisTurn flags, swap player,
// reset activation budget, increment turn counter.
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
