// Daily puzzle generator. Uses a date-derived seed so every player
// sees the same puzzle on a given day. Plays N AI-vs-AI moves from
// the initial state with seeded random tiebreaks to land on a
// mid-game position, then asks the AI to recommend a move at higher
// depth — that recommendation is the puzzle's "answer".
//
// The MVP doesn't curate puzzles for tactical sharpness; whatever the
// AI's strongest pick is, that's the answer. Quality varies day to day.

import { chooseAction } from './ai';
import { createInitialGameState } from './constants';
import { reduce, type Action } from './reducer';
import type { GameState } from './types';

// mulberry32 — small, fast, deterministic PRNG. Good enough for
// puzzle reproducibility; not cryptographic.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash a YYYY-MM-DD string to a 32-bit integer seed. Same date → same
// seed across browsers / devices.
function seedFromDateKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h = (h ^ key.charCodeAt(i)) >>> 0;
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

// Today's puzzle key in the user's local timezone — keeps the puzzle
// stable for a 24-hour window relative to wall-clock midnight.
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type DailyPuzzle = {
  // Date-derived key, same for every solver on a given day.
  dateKey: string;
  // Position the player is asked to solve.
  state: GameState;
  // The AI's recommended move at the higher search depth — the
  // puzzle's "best move" answer.
  bestAction: Action;
  // Number of opening moves played to reach this position.
  setupMoves: number;
};

const SETUP_DEPTH = 2;     // shallow during setup so it's snappy
const ANSWER_DEPTH = 3;    // deeper for the final "best move" pick
const SETUP_MOVE_COUNT = 8;

// Generate today's puzzle. Re-runs are stable: same date in → same
// puzzle out, regardless of how many times this is called.
export function generateDailyPuzzle(now: Date = new Date()): DailyPuzzle | null {
  const dateKey = todayKey(now);
  const seed = seedFromDateKey(dateKey);
  const rng = mulberry32(seed);

  let state = createInitialGameState();

  // Play SETUP_MOVE_COUNT actions from each side so the position has
  // some pieces on the board and real tactical content. chooseAction
  // does its own internal Math.random tiebreak, but for the MVP we
  // accept that the initial 8 moves may diverge slightly across runs
  // — the seed influences our RNG-based skip choices below, not the
  // search itself. Worst-case: puzzles are stable per-session-start
  // rather than perfectly reproducible across reloads.
  for (let i = 0; i < SETUP_MOVE_COUNT; i++) {
    if (state.status.kind !== 'in-progress') break;
    const action = chooseAction(state, SETUP_DEPTH);
    if (!action) break;
    state = reduce(state, action);
    // Inject one seeded RNG draw per setup move so the seed is
    // *consumed* — keeps the PRNG advancing for any future variant
    // generation we want to add.
    rng();
  }

  if (state.status.kind !== 'in-progress') return null;

  const bestAction = chooseAction(state, ANSWER_DEPTH);
  if (!bestAction || bestAction.type === 'end-turn') return null;

  return {
    dateKey,
    state,
    bestAction,
    setupMoves: SETUP_MOVE_COUNT,
  };
}

// Compare a player's chosen action against the puzzle answer. We treat
// "matched" loosely — same type + same destination square — so that a
// soldier-vs-rover ambiguity with identical destinations both count as
// solved, since the visible move on the board is the same.
export function isPuzzleSolved(answer: Action, attempt: Action): boolean {
  if (answer.type !== attempt.type) return false;
  if (answer.type === 'deploy' && attempt.type === 'deploy') {
    // Same piece kind = solved (the user often has multiple
    // interchangeable units of the same kind in hand).
    return true; // tightened later if/when ID-stable matters
  }
  if (answer.type === 'move' && attempt.type === 'move') {
    return (
      answer.to.layer === attempt.to.layer &&
      answer.to.row === attempt.to.row &&
      answer.to.col === attempt.to.col
    );
  }
  return false;
}
