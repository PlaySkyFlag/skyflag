import { DEPLOY_COORDS, FLAG_COORDS, NEXUS_COORD } from './constants';
import { legalMovesFor } from './moves';
import { reduce, type Action } from './reducer';
import type { Coord, FlagsState, GameState, Layer, PieceKind, Player } from './types';
import { opponentOf } from './types';

const LAYER_INDEX: Record<Layer, number> = { ground: 0, sky: 1, space: 2 };

function isOccupied(state: GameState, c: Coord): boolean {
  return state.onBoard.some(
    (bp) => bp.coord.layer === c.layer && bp.coord.row === c.row && bp.coord.col === c.col,
  );
}

// Every legal action the current player could take from `state`. End-turn is
// excluded — the caller dispatches it as a fallback when nothing else works.
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

// Per-piece-kind weight, used both for capture rewards and threat penalties.
function pieceValue(kind: PieceKind): number {
  switch (kind) {
    case 'captain': return 100;
    case 'soldier': return 60;
    case 'rover':   return 30;
    case 'pilot':   return 30;
  }
}

function countStandingFlags(flags: FlagsState, player: Player): number {
  return (
    (flags.ground[player] ? 0 : 1) +
    (flags.sky[player] ? 0 : 1) +
    (flags.space[player] ? 0 : 1)
  );
}

// Distance metric tuned for Skyflag geometry: Chebyshev within a layer (matches
// Captain king-move) + heavy layer-change cost (lifts take two activations).
function strategicDist(a: Coord, b: Coord): number {
  const layerCost = Math.abs(LAYER_INDEX[a.layer] - LAYER_INDEX[b.layer]) * 4;
  const dx = Math.abs(a.row - b.row);
  const dy = Math.abs(a.col - b.col);
  return layerCost + Math.max(dx, dy);
}

// Where should `me`'s win-capable pieces be heading? The next un-captured
// opponent flag (Ground → Sky → Space order), or the Nexus if all 3 are gone.
function pickStrategicTarget(state: GameState, me: Player): Coord | null {
  const opp = opponentOf(me);
  const layers: Layer[] = ['ground', 'sky', 'space'];
  for (const layer of layers) {
    if (!state.flags[layer][opp]) {
      const f = FLAG_COORDS[opp][layer];
      return { layer, row: f.row, col: f.col };
    }
  }
  return NEXUS_COORD;
}

// Crude threat check: can any of `attacker`'s on-board pieces capture-by-
// landing on `coord` from the given `state`? Lift steps can't capture so
// they're naturally excluded — but legalMovesFor mixes them in for lift-cell
// pieces, and those lift destinations are guaranteed empty so they don't
// match an occupied target cell anyway.
function wouldBeAttacked(state: GameState, coord: Coord, attacker: Player): boolean {
  for (const bp of state.onBoard) {
    if (bp.piece.owner !== attacker) continue;
    const moves = legalMovesFor(bp, state);
    for (const m of moves) {
      if (m.layer === coord.layer && m.row === coord.row && m.col === coord.col) {
        return true;
      }
    }
  }
  return false;
}

function scoreAction(state: GameState, action: Action): number {
  const me = state.currentPlayer;
  const opp = opponentOf(me);
  const next = reduce(state, action);

  // Winning move dwarfs everything else.
  if (next.status.kind === 'won' && next.status.winner === me) {
    return 100_000;
  }

  let score = 0;

  // Flag captures (compare standing-flag counts before/after).
  const flagsLost = countStandingFlags(state.flags, opp) - countStandingFlags(next.flags, opp);
  score += flagsLost * 500;

  // Piece captures — weight by victim's value.
  const newCaptures = next.captured[opp].slice(state.captured[opp].length);
  for (const lost of newCaptures) {
    score += pieceValue(lost.kind);
  }

  if (action.type === 'move') {
    const movingBp = state.onBoard.find((bp) => bp.piece.id === action.pieceId);
    const movingPiece = movingBp?.piece;

    // Approach to strategic target — only meaningful for win-capable pieces
    // (Captain or Soldier, which can promote into a Captain).
    if (movingBp && movingPiece && (movingPiece.kind === 'captain' || movingPiece.kind === 'soldier')) {
      const target = pickStrategicTarget(state, me);
      if (target) {
        const before = strategicDist(movingBp.coord, target);
        const after = strategicDist(action.to, target);
        score += Math.max(0, before - after) * 3;
      }
    }

    // Threat penalty — moving into an attacked square is bad, weighted by
    // how much it'd hurt to lose this piece.
    if (movingPiece && wouldBeAttacked(next, action.to, opp)) {
      score -= pieceValue(movingPiece.kind) * 0.4;
    }
  }

  // Deploy gets a small early-game bias so the AI doesn't sit on its hand.
  if (action.type === 'deploy') {
    score += 5 + state.inHand[me].length * 2;
  }

  // Tiny noise so exact ties pick a varied action across games.
  score += Math.random() * 0.5;

  return score;
}

// Returns a single Action the AI wants to take from `state`, or null when no
// legal action exists (caller should dispatch end-turn).
export function chooseAction(state: GameState): Action | null {
  const actions = legalActions(state);
  if (actions.length === 0) return null;

  let best = actions[0];
  let bestScore = scoreAction(state, best);
  for (let i = 1; i < actions.length; i++) {
    const s = scoreAction(state, actions[i]);
    if (s > bestScore) {
      best = actions[i];
      bestScore = s;
    }
  }
  return best;
}
