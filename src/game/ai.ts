import { DEPLOY_COORDS, FLAG_COORDS, NEXUS_COORD } from './constants';
import { legalMovesFor } from './moves';
import { reduce, type Action } from './reducer';
import type { Coord, GameState, Layer, PieceKind, Player } from './types';
import { opponentOf } from './types';

// Search depth in plies (one ply = one activation). 3 plies ≈ 1.5 turns of
// foresight. Tunable; raising it makes the AI stronger but slower.
const SEARCH_DEPTH = 3;

const WIN_SCORE = 1_000_000;
const LAYER_INDEX: Record<Layer, number> = { ground: 0, sky: 1, space: 2 };

function pieceValue(kind: PieceKind): number {
  switch (kind) {
    case 'captain': return 100;
    case 'soldier': return 60;
    case 'rover':   return 30;
    case 'pilot':   return 30;
  }
}

function isOccupied(state: GameState, c: Coord): boolean {
  return state.onBoard.some(
    (bp) => bp.coord.layer === c.layer && bp.coord.row === c.row && bp.coord.col === c.col,
  );
}

// Every legal Action the current player could take. End-turn excluded —
// reducers/AI fall back to that when nothing else is available.
export function legalActions(state: GameState): Action[] {
  if (state.status.kind !== 'in-progress') return [];
  if (state.activationsRemaining <= 0) return [];

  const actions: Action[] = [];
  const player = state.currentPlayer;

  const deployCoord = DEPLOY_COORDS[player];
  if (!isOccupied(state, deployCoord)) {
    for (const piece of state.inHand[player]) {
      actions.push({ type: 'deploy', pieceId: piece.id });
    }
  }

  for (const bp of state.onBoard) {
    if (bp.piece.owner !== player) continue;
    for (const target of legalMovesFor(bp, state)) {
      actions.push({ type: 'move', pieceId: bp.piece.id, to: target });
    }
  }

  return actions;
}

// Distance metric tuned for SkyFlag: Chebyshev within a layer (Captain king-
// move) + heavy layer-change cost (lifts take two activations).
function strategicDist(a: Coord, b: Coord): number {
  const layerCost = Math.abs(LAYER_INDEX[a.layer] - LAYER_INDEX[b.layer]) * 4;
  return layerCost + Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

// Player p's next strategic target: the next un-captured opponent flag
// (Ground → Sky → Space order), or the Nexus once all 3 are gone.
function targetFor(state: GameState, p: Player): Coord {
  const opp = opponentOf(p);
  const layers: Layer[] = ['ground', 'sky', 'space'];
  for (const layer of layers) {
    if (!state.flags[layer][opp]) {
      const f = FLAG_COORDS[opp][layer];
      return { layer, row: f.row, col: f.col };
    }
  }
  return NEXUS_COORD;
}

// Closest distance from any of player p's win-capable on-board pieces
// (Captains + Soldiers) to their strategic target. Returns Infinity if none.
function closestDistToTarget(state: GameState, p: Player): number {
  const target = targetFor(state, p);
  let best = Infinity;
  for (const bp of state.onBoard) {
    if (bp.piece.owner !== p) continue;
    if (bp.piece.kind !== 'captain' && bp.piece.kind !== 'soldier') continue;
    const d = strategicDist(bp.coord, target);
    if (d < best) best = d;
  }
  return best;
}

// Static evaluation of `state` from `aiPlayer`'s perspective. Higher = better
// for aiPlayer. Deterministic — minimax requires same input → same output.
function evaluate(state: GameState, aiPlayer: Player): number {
  if (state.status.kind === 'won') {
    return state.status.winner === aiPlayer ? WIN_SCORE : -WIN_SCORE;
  }
  if (state.status.kind === 'draw') return 0;

  const opp = opponentOf(aiPlayer);
  let score = 0;

  // Material — board pieces are worth full value, in-hand discounted (they
  // can still be captured before deploy via elimination win, but not directly).
  for (const bp of state.onBoard) {
    score += pieceValue(bp.piece.kind) * (bp.piece.owner === aiPlayer ? 1 : -1);
  }
  for (const piece of state.inHand[aiPlayer]) score += pieceValue(piece.kind) * 0.7;
  for (const piece of state.inHand[opp])      score -= pieceValue(piece.kind) * 0.7;

  // Flag progress — opponent flags I've captured are good; mine they took, bad.
  for (const layer of ['ground', 'sky', 'space'] as const) {
    if (state.flags[layer][opp])      score += 500;
    if (state.flags[layer][aiPlayer]) score -= 500;
  }

  // Strategic positioning — closer is better for me, opponent farther is also
  // better for me. Each square of distance worth ~3 score points.
  const myDist  = closestDistToTarget(state, aiPlayer);
  const oppDist = closestDistToTarget(state, opp);
  if (myDist  !== Infinity) score -= myDist * 3;
  if (oppDist !== Infinity) score += oppDist * 3;

  return score;
}

// Cheap heuristic for move ordering — captures and flag-captures get tried
// first, which makes alpha-beta cuts much more effective.
function orderingHeuristic(state: GameState, action: Action): number {
  if (action.type !== 'move') return 0;

  const target = state.onBoard.find(
    (bp) =>
      bp.coord.layer === action.to.layer &&
      bp.coord.row === action.to.row &&
      bp.coord.col === action.to.col &&
      bp.piece.owner !== state.currentPlayer,
  );
  if (target) return 200 + pieceValue(target.piece.kind);

  const piece = state.onBoard.find((bp) => bp.piece.id === action.pieceId)?.piece;
  if (piece?.kind === 'captain') {
    const opp = opponentOf(state.currentPlayer);
    const flag = FLAG_COORDS[opp][action.to.layer];
    if (
      action.to.row === flag.row &&
      action.to.col === flag.col &&
      !state.flags[action.to.layer][opp]
    ) {
      return 400;
    }
  }

  return 0;
}

function orderActions(state: GameState, actions: Action[]): Action[] {
  return actions
    .map((a) => ({ a, h: orderingHeuristic(state, a) }))
    .sort((x, y) => y.h - x.h)
    .map((s) => s.a);
}

// Minimax with alpha-beta. `aiPlayer` is fixed throughout the search (the side
// we're optimising for). Whether a node is a max- or min-node depends on
// whether state.currentPlayer matches `aiPlayer`.
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  aiPlayer: Player,
): number {
  if (depth === 0 || state.status.kind !== 'in-progress') {
    return evaluate(state, aiPlayer);
  }

  const actions = legalActions(state);
  if (actions.length === 0) {
    // No legal action — the player must end-turn. Recurse on the resulting
    // state (turn passes to opponent).
    const next = reduce(state, { type: 'end-turn' });
    return minimax(next, depth - 1, alpha, beta, aiPlayer);
  }

  const ordered = orderActions(state, actions);
  const isMax = state.currentPlayer === aiPlayer;

  if (isMax) {
    let value = -Infinity;
    for (const action of ordered) {
      const next = reduce(state, action);
      value = Math.max(value, minimax(next, depth - 1, alpha, beta, aiPlayer));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const action of ordered) {
    const next = reduce(state, action);
    value = Math.min(value, minimax(next, depth - 1, alpha, beta, aiPlayer));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

export function chooseAction(state: GameState): Action | null {
  // History isn't read by the search and the reducer clones the array on
  // every action. Stripping it on entry removes that growing per-clone
  // cost, which is the main reason the AI was getting laggy mid-game now
  // that the move history feature ships entries with every action.
  if (state.history.length > 0) {
    state = { ...state, history: [] };
  }

  const actions = legalActions(state);
  if (actions.length === 0) return null;

  const aiPlayer = state.currentPlayer;
  const ordered = orderActions(state, actions);

  // Top-level: evaluate each candidate fully (no top-level pruning since
  // we want the actual best score for tiebreaking).
  let bestValue = -Infinity;
  const scored: Array<{ action: Action; value: number }> = [];
  let alpha = -Infinity;

  for (const action of ordered) {
    const next = reduce(state, action);
    const value = minimax(next, SEARCH_DEPTH - 1, alpha, Infinity, aiPlayer);
    scored.push({ action, value });
    if (value > bestValue) bestValue = value;
    alpha = Math.max(alpha, value);
  }

  // Random tiebreak among top-scoring actions.
  const top = scored.filter((s) => s.value === bestValue);
  return top[Math.floor(Math.random() * top.length)].action;
}
