import { DEPLOY_COORDS, FLAG_COORDS } from './constants';
import { legalMovesFor } from './moves';
import type { Action } from './reducer';
import type { Coord, GameState } from './types';
import { opponentOf } from './types';

function isOccupied(state: GameState, c: Coord): boolean {
  return state.onBoard.some(
    (bp) => bp.coord.layer === c.layer && bp.coord.row === c.row && bp.coord.col === c.col,
  );
}

// Every legal action the current player could take from `state`. Used by the
// AI; deliberately doesn't include `end-turn`, which is a fallback when no
// other action is possible.
export function legalActions(state: GameState): Action[] {
  if (state.status.kind !== 'in-progress') return [];
  if (state.activationsRemaining <= 0) return [];

  const actions: Action[] = [];
  const player = state.currentPlayer;

  // Deploys — only if the deploy cell is empty.
  const deployCoord = DEPLOY_COORDS[player];
  if (!isOccupied(state, deployCoord)) {
    for (const piece of state.inHand[player]) {
      actions.push({ type: 'deploy', pieceId: piece.id });
    }
  }

  // Moves and lift steps — legalMovesFor returns both.
  for (const bp of state.onBoard) {
    if (bp.piece.owner !== player) continue;
    for (const target of legalMovesFor(bp, state)) {
      actions.push({ type: 'move', pieceId: bp.piece.id, to: target });
    }
  }

  return actions;
}

// "High value" today means: captures an opponent piece OR captures a still-
// standing opponent flag. A simple heuristic that gives the random AI enough
// teeth to make playtesting useful.
function isHighValueAction(state: GameState, action: Action): boolean {
  if (action.type !== 'move') return false;

  const opponentAtDest = state.onBoard.some(
    (bp) =>
      bp.coord.layer === action.to.layer &&
      bp.coord.row === action.to.row &&
      bp.coord.col === action.to.col &&
      bp.piece.owner !== state.currentPlayer,
  );
  if (opponentAtDest) return true;

  const movingPiece = state.onBoard.find((bp) => bp.piece.id === action.pieceId)?.piece;
  if (movingPiece?.kind === 'captain') {
    const opp = opponentOf(state.currentPlayer);
    const flagCoord = FLAG_COORDS[opp][action.to.layer];
    if (
      action.to.row === flagCoord.row &&
      action.to.col === flagCoord.col &&
      !state.flags[action.to.layer][opp]
    ) {
      return true;
    }
  }

  return false;
}

// Returns a single Action the AI wants to take from `state`. Prefers high-
// value actions when any exist, otherwise picks uniformly from all legal
// actions. Returns null when no legal action is available — the caller is
// expected to dispatch `end-turn`.
export function chooseAction(state: GameState): Action | null {
  const all = legalActions(state);
  if (all.length === 0) return null;

  const highValue = all.filter((a) => isHighValueAction(state, a));
  const pool = highValue.length > 0 ? highValue : all;
  return pool[Math.floor(Math.random() * pool.length)];
}
