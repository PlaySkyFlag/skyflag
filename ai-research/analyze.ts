/**
 * Skyflag rule-faithfulness + balance harness.
 *
 * Wraps the SHIPPED engine (legalActions + reduce) so the numbers here are
 * exactly what the app plays — no re-implementation of move generation. Two
 * jobs:
 *
 *   perft    Count the activation-tree to depth N from the opening. These node
 *            counts are the cross-check ORACLE for a Ludii (or Ai Ai) formal
 *            spec: if the formal spec's legal-move tree diverges from these,
 *            one of the two is wrong about the rules — exactly the
 *            "is the vibe-coded program faithful?" check.
 *
 *   balance  Random self-play rollouts → game-length distribution, outcome /
 *            reason breakdown, first-player (P1) win rate, mean branching
 *            factor. The design-oracle balance metrics, available before
 *            Ludii is even installed.
 *
 * NOTE ON "PLY": Skyflag gives each player 2 activations per turn, and
 * legalActions() enumerates ONE activation (a deploy or a single move/lift).
 * reduce() auto-passes initiative when activations hit 0. So one tree edge =
 * one activation, and "plies" below counts activations, not full turns. A
 * Ludii spec must use the same decision granularity for perft to line up.
 *
 * Run:
 *   npx tsx ai-research/analyze.ts perft --depth 5
 *   npx tsx ai-research/analyze.ts balance --games 2000 --seed 1
 */

import { createInitialGameState } from '../src/game/constants';
import { reduce, type Action } from '../src/game/reducer';
import { legalActions, chooseAction } from '../src/game/ai';
import type { GameState } from '../src/game/types';

// Seed the AI's Math.random for the duration of a chooseAction call so strong
// self-play is reproducible (the stance picker + equal-move tiebreaks read it).
// Same pattern as scripts/selfplay.ts withSeededRandom.
function withSeededRandom<T>(prng: () => number, fn: () => T): T {
  const orig = Math.random;
  Math.random = prng;
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

// The side to move can legally have NO deploy and NO move (deploy cell blocked
// by own piece, every on-board piece pinned) while the OPPONENT can still act —
// so it is not a stalemate and the game is still in-progress. The shipped app
// resolves this with the UI end-turn button; legalActions() deliberately omits
// it. Any faithful playout / GGP spec must therefore model a FORCED PASS here.
// This helper restores it: it returns legalActions, or a single forced
// end-turn when the position is live but has no move, or [] when terminal.
const END_TURN: Action = { type: 'end-turn' };
function actionsWithPass(state: GameState): Action[] {
  if (state.status.kind !== 'in-progress') return [];
  const moves = legalActions(state);
  return moves.length > 0 ? moves : [END_TURN];
}

// ── seeded PRNG (mulberry32) so balance runs are reproducible ───────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── perft ───────────────────────────────────────────────────────────────────
type PerftRow = { depth: number; nodes: number; terminals: number };

function perft(state: GameState, depth: number, acc: PerftRow[]): number {
  if (depth === 0) return 1;
  const actions = actionsWithPass(state);
  // Empty here means the game is genuinely over (win/draw committed inside
  // reduce). A live-but-no-move position returns a forced end-turn instead.
  if (actions.length === 0) {
    acc[depth].terminals++;
    return 1;
  }
  let nodes = 0;
  for (const a of actions) {
    nodes += perft(reduce(state, a), depth - 1, acc);
  }
  acc[depth].nodes += actions.length;
  return nodes;
}

function runPerft(maxDepth: number): void {
  console.log(`\nPerft from the opening position (one edge = one activation)\n`);
  console.log('  depth     leaves        edges    terminal-leaves');
  console.log('  -----  ----------  -----------  ----------------');
  for (let d = 1; d <= maxDepth; d++) {
    const acc: PerftRow[] = Array.from({ length: d + 1 }, (_, i) => ({
      depth: i,
      nodes: 0,
      terminals: 0,
    }));
    const t0 = Date.now();
    const leaves = perft(createInitialGameState(), d, acc);
    const ms = Date.now() - t0;
    const edges = acc.reduce((s, r) => s + r.nodes, 0);
    const terms = acc.reduce((s, r) => s + r.terminals, 0);
    console.log(
      `  ${String(d).padStart(5)}  ${String(leaves).padStart(10)}  ${String(edges).padStart(11)}  ${String(terms).padStart(16)}   (${ms} ms)`,
    );
  }
  console.log(
    `\n  → Hand these leaf counts to the Ludii spec's perft. They must match exactly.\n`,
  );
}

// ── balance via random rollouts ──────────────────────────────────────────────
type Outcome = {
  winner: 'p1' | 'p2' | null;
  reason: string;
  plies: number; // activations
  turns: number;
  branchingSum: number; // sum of legal-action counts at real-decision nodes
  branchingN: number; // count of real-decision nodes (excludes forced passes)
};

function randomPlayout(rng: () => number, maxPlies: number): Outcome {
  let state = createInitialGameState();
  let plies = 0;
  let branchingSum = 0;
  let branchingN = 0;
  while (state.status.kind === 'in-progress' && plies < maxPlies) {
    const actions = actionsWithPass(state);
    if (actions.length === 0) break; // genuinely terminal
    // Don't count a forced pass toward the branching-factor average — it is a
    // no-choice node, not a real decision.
    if (!(actions.length === 1 && actions[0] === END_TURN)) {
      branchingSum += actions.length;
      branchingN++;
    }
    const a: Action = actions[Math.floor(rng() * actions.length)];
    state = reduce(state, a);
    plies++;
  }
  const winner =
    state.status.kind === 'won' ? state.status.winner : null;
  const reason =
    state.status.kind === 'in-progress' ? 'cutoff' : state.status.reason;
  return { winner, reason, plies, turns: state.turnNumber, branchingSum, branchingN };
}

// ── strong self-play via the shipped chooseAction (NNUE-off alpha-beta) ──────
// Both sides use the same config, so this isolates first-player bias and the
// outcome mix under STRONG play — the contrast with the random baseline is the
// point (e.g. nexus wins should appear, draw mix should shift).
function strongPlayout(
  gameSeed: number,
  depth: number,
  timeMs: number | undefined,
  maxPlies: number,
): Outcome {
  const prng = mulberry32(gameSeed);
  let state = createInitialGameState();
  let plies = 0;
  let branchingSum = 0;
  let branchingN = 0;
  while (state.status.kind === 'in-progress' && plies < maxPlies) {
    const actions = actionsWithPass(state);
    if (actions.length === 0) break;
    // chooseAction returns null when it has no move — that is the forced-pass
    // position (RULES.md §7); issue the end-turn the app's button would.
    const picked =
      actions.length === 1 && actions[0] === END_TURN
        ? END_TURN
        : withSeededRandom(prng, () => chooseAction(state, depth, timeMs)) ?? END_TURN;
    if (!(actions.length === 1 && actions[0] === END_TURN)) {
      branchingSum += actions.length;
      branchingN++;
    }
    state = reduce(state, picked);
    plies++;
  }
  const winner = state.status.kind === 'won' ? state.status.winner : null;
  const reason = state.status.kind === 'in-progress' ? 'cutoff' : state.status.reason;
  return { winner, reason, plies, turns: state.turnNumber, branchingSum, branchingN };
}

// Shared aggregation + report for any Outcome generator.
function summarize(title: string, games: number, outcomes: Outcome[]): void {
  let p1 = 0,
    p2 = 0,
    draws = 0;
  const reasons = new Map<string, number>();
  let turnsSum = 0,
    branchingSum = 0,
    branchingN = 0;
  const lengths: number[] = [];
  for (const o of outcomes) {
    if (o.winner === 'p1') p1++;
    else if (o.winner === 'p2') p2++;
    else draws++;
    reasons.set(o.reason, (reasons.get(o.reason) ?? 0) + 1);
    turnsSum += o.turns;
    branchingSum += o.branchingSum;
    branchingN += o.branchingN;
    lengths.push(o.turns);
  }
  lengths.sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
  const decisive = p1 + p2;

  console.log(`\n${title}\n`);
  console.log(`  P1 wins        ${String(p1).padStart(6)}   ${pct(p1)}`);
  console.log(`  P2 wins        ${String(p2).padStart(6)}   ${pct(p2)}`);
  console.log(`  Draws          ${String(draws).padStart(6)}   ${pct(draws)}`);
  console.log(
    `  P1 share of decisive games: ${
      decisive ? ((100 * p1) / decisive).toFixed(1) : '—'
    }%   (50% = no first-player bias)`,
  );
  console.log(`\n  outcome reasons:`);
  for (const [r, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${r.padEnd(14)} ${String(n).padStart(6)}   ${pct(n)}`);
  }
  console.log(`\n  game length (turns):  mean ${(turnsSum / games).toFixed(1)}   median ${median}`);
  console.log(`  mean branching (legal activations/decision): ${(branchingSum / branchingN).toFixed(2)}`);
}

function runBalance(games: number, seed: number, maxPlies: number): void {
  const rng = mulberry32(seed);
  const outcomes: Outcome[] = [];
  for (let g = 0; g < games; g++) outcomes.push(randomPlayout(rng, maxPlies));
  summarize(`Random-rollout balance over ${games} games (seed ${seed})`, games, outcomes);
  console.log(
    `\n  NB: RANDOM play — first-player bias under strong play will differ.\n` +
      `  Compare against \`analyze.ts strong\` and Ludii MCTS playouts.\n`,
  );
}

function runStrong(
  games: number,
  seed: number,
  depth: number,
  timeMs: number | undefined,
  maxPlies: number,
): void {
  const outcomes: Outcome[] = [];
  const t0 = Date.now();
  for (let g = 0; g < games; g++) {
    // Per-game seed derived from the master seed → reproducible, distinct games.
    outcomes.push(strongPlayout(seed * 1_000_003 + g, depth, timeMs, maxPlies));
    process.stderr.write(`\r  played ${g + 1}/${games} …`);
  }
  process.stderr.write('\r');
  summarize(
    `Strong self-play balance — chooseAction depth ${depth}${
      timeMs ? ` / ${timeMs}ms` : ''
    }, ${games} games (seed ${seed})`,
    games,
    outcomes,
  );
  console.log(
    `\n  Both sides identical config, so this isolates first-player edge + the\n` +
      `  outcome mix under STRONG play. Contrast nexus-win % and draw mix vs the\n` +
      `  random baseline. (${((Date.now() - t0) / 1000).toFixed(1)}s for ${games} games.)\n`,
  );
}

// ── cli ───────────────────────────────────────────────────────────────────
function argVal(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def;
}

const mode = process.argv[2];
if (mode === 'perft') {
  runPerft(argVal('depth', 5));
} else if (mode === 'balance') {
  runBalance(argVal('games', 2000), argVal('seed', 1), argVal('maxPlies', 2000));
} else if (mode === 'strong') {
  const hasTime = process.argv.includes('--time');
  runStrong(
    argVal('games', 40),
    argVal('seed', 1),
    argVal('depth', 4),
    hasTime ? argVal('time', 1000) : undefined,
    argVal('maxPlies', 2000),
  );
} else {
  console.log(
    `usage:\n` +
      `  npx tsx ai-research/analyze.ts perft   [--depth 5]\n` +
      `  npx tsx ai-research/analyze.ts balance [--games 2000] [--seed 1] [--maxPlies 2000]\n` +
      `  npx tsx ai-research/analyze.ts strong  [--games 40] [--depth 4] [--time 1000] [--seed 1]`,
  );
  process.exit(1);
}
