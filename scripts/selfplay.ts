/*
 * Self-play benchmark harness.
 *
 * Pits two engine configurations against each other over N games and
 * reports win rate + game-length stats. Intended for A/B testing engine
 * changes: lock the baseline config, change the code, re-run with the
 * same --seed, compare.
 *
 * Run:
 *   npm run selfplay                       # defaults: 20 games, A=depth4 vs B=depth3
 *   npm run selfplay -- --games 50
 *   npm run selfplay -- --depth-a 5 --depth-b 4 --games 30
 *   npm run selfplay -- --time-a 800 --time-b 400 --games 20
 *   npm run selfplay -- --seed 42 --no-swap
 *
 * Both sides start the game; `--swap` (default on) alternates which engine
 * plays P1 across games so neither config gets a free first-mover advantage.
 *
 * The strategic-stance picker and the tiebreak among equal-value moves in
 * `chooseAction` use Math.random(). We monkey-patch Math.random with a
 * seeded PRNG during chooseAction calls so results are reproducible for a
 * given --seed. Restored after each call so app-side randomness is unaffected.
 */

import { chooseAction, setSearchOptions, type SearchOptions } from '../src/game/ai';
import { createInitialGameState } from '../src/game/constants';
import { reduce, type Action } from '../src/game/reducer';
import type { Player } from '../src/game/types';

// ─── CLI args ──────────────────────────────────────────────────────────────

type Args = {
  games: number;
  depthA: number;
  depthB: number;
  timeAMs: number | null;
  timeBMs: number | null;
  seed: number;
  swap: boolean;
  maxTurns: number;
  quiet: boolean;
  optsA: Partial<SearchOptions>;
  optsB: Partial<SearchOptions>;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    games: 20,
    depthA: 4,
    depthB: 3,
    timeAMs: null,
    timeBMs: null,
    seed: 1,
    swap: true,
    maxTurns: 300,
    quiet: false,
    optsA: {},
    optsB: {},
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--games':     args.games    = parseInt(v, 10); i++; break;
      case '--depth-a':   args.depthA   = parseInt(v, 10); i++; break;
      case '--depth-b':   args.depthB   = parseInt(v, 10); i++; break;
      case '--time-a':    args.timeAMs  = parseInt(v, 10); i++; break;
      case '--time-b':    args.timeBMs  = parseInt(v, 10); i++; break;
      case '--seed':      args.seed     = parseInt(v, 10); i++; break;
      case '--max-turns': args.maxTurns = parseInt(v, 10); i++; break;
      case '--no-swap':   args.swap     = false; break;
      case '--quiet':     args.quiet    = true; break;
      // Per-engine feature toggles. --no-X-a forces X off for A;
      // --X-a forces X on for A; same for B; bare --X / --no-X applies
      // to both. Forcing ON is useful now that null-move is OFF by
      // default (after benchmark) — needed to A/B test re-enabling it.
      case '--no-null-a': args.optsA.enableNullMove = false; break;
      case '--no-null-b': args.optsB.enableNullMove = false; break;
      case '--no-null':   args.optsA.enableNullMove = args.optsB.enableNullMove = false; break;
      case '--null-a':    args.optsA.enableNullMove = true; break;
      case '--null-b':    args.optsB.enableNullMove = true; break;
      case '--null':      args.optsA.enableNullMove = args.optsB.enableNullMove = true; break;
      case '--no-lmr-a':  args.optsA.enableLMR = false; break;
      case '--no-lmr-b':  args.optsB.enableLMR = false; break;
      case '--no-lmr':    args.optsA.enableLMR = args.optsB.enableLMR = false; break;
      case '--no-tt-a':   args.optsA.enableTT = false; break;
      case '--no-tt-b':   args.optsB.enableTT = false; break;
      case '--no-tt':     args.optsA.enableTT = args.optsB.enableTT = false; break;
      case '--no-qs-a':   args.optsA.enableQuiescence = false; break;
      case '--no-qs-b':   args.optsB.enableQuiescence = false; break;
      case '--no-qs':     args.optsA.enableQuiescence = args.optsB.enableQuiescence = false; break;
      case '--bal-a':     args.optsA.forceBalancedStance = true; break;
      case '--bal-b':     args.optsB.forceBalancedStance = true; break;
      case '--bal':       args.optsA.forceBalancedStance = args.optsB.forceBalancedStance = true; break;
      case '--help':
      case '-h':
        console.log(
          'selfplay --games N --depth-a D --depth-b D [--time-a MS] [--time-b MS]\n' +
          '         [--seed N] [--no-swap] [--max-turns N] [--quiet]\n' +
          '         [--no-null|--no-null-a|--no-null-b]   disable null-move pruning\n' +
          '         [--no-lmr |--no-lmr-a |--no-lmr-b ]   disable late-move reduction\n' +
          '         [--no-tt  |--no-tt-a  |--no-tt-b  ]   disable transposition table\n' +
          '         [--no-qs  |--no-qs-a  |--no-qs-b  ]   disable quiescence search',
        );
        process.exit(0);
    }
  }
  return args;
}

function describeOpts(opts: Partial<SearchOptions>): string {
  const off: string[] = [];
  if (opts.enableNullMove === false) off.push('null');
  if (opts.enableLMR === false) off.push('LMR');
  if (opts.enableTT === false) off.push('TT');
  if (opts.enableQuiescence === false) off.push('qs');
  if (opts.forceBalancedStance) off.push('bal');
  return off.length ? ` -${off.join(',')}` : '';
}

// ─── Seeded PRNG (splitmix32) ──────────────────────────────────────────────

function makePrng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x9E3779B9) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
    t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
}

// Wrap chooseAction so Math.random is seeded during the call and restored
// after. The stance picker reads Math.random the first time it sees a
// turnNumber that's smaller than the previous high-water mark (i.e. fresh
// game), and tiebreaks among equal-value top moves read it at the end.
function withSeededRandom<T>(prng: () => number, fn: () => T): T {
  const orig = Math.random;
  Math.random = prng;
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

// ─── Single game ───────────────────────────────────────────────────────────

type EngineConfig = {
  name: string;
  depth: number;
  timeBudgetMs: number | null;
  opts: Partial<SearchOptions>;
};

type GameResult = {
  winner: 'A' | 'B' | 'draw';
  reason: string;
  turns: number;
  durationMs: number;
  // Which side (P1 or P2) engine A played; the converse is B.
  aSide: Player;
  actions: number;
};

function playGame(
  engineA: EngineConfig,
  engineB: EngineConfig,
  aSide: Player,
  gameSeed: number,
  maxTurns: number,
): GameResult {
  // Fresh PRNG per game so engines under different configurations see
  // identical stance pairings — without this, the harness leaks
  // between-game PRNG state and an engine that consumes more random
  // numbers (more tiebreaks per move = more search work) shifts the
  // stance distribution for subsequent games of the same run, which
  // contaminates A/B comparison.
  const prng = makePrng(gameSeed);
  let state = createInitialGameState();
  const start = performance.now();
  let actions = 0;

  while (state.status.kind === 'in-progress' && state.turnNumber <= maxTurns) {
    const current = state.currentPlayer;
    const useA = current === aSide;
    const cfg = useA ? engineA : engineB;

    setSearchOptions(cfg.opts);
    const picked = withSeededRandom(prng, () =>
      chooseAction(state, cfg.depth, cfg.timeBudgetMs ?? undefined),
    );

    const next: Action = picked ?? { type: 'end-turn' };
    state = reduce(state, next);
    actions++;
  }

  const durationMs = performance.now() - start;

  let winner: GameResult['winner'];
  let reason: string;
  if (state.status.kind === 'won') {
    winner = state.status.winner === aSide ? 'A' : 'B';
    reason = state.status.reason;
  } else if (state.status.kind === 'draw') {
    winner = 'draw';
    reason = state.status.reason;
  } else {
    // Hit maxTurns without a result — call it a draw with reason 'cap'.
    winner = 'draw';
    reason = 'max-turns-cap';
  }

  return {
    winner,
    reason,
    turns: state.turnNumber,
    durationMs,
    aSide,
    actions,
  };
}

// ─── Multi-game runner ─────────────────────────────────────────────────────

type Summary = {
  games: number;
  aWins: number;
  bWins: number;
  draws: number;
  aWinRate: number;
  drawRate: number;
  avgTurns: number;
  avgDurationMs: number;
  avgActions: number;
  byReason: Record<string, number>;
  byAside: { p1: { a: number; b: number; d: number }; p2: { a: number; b: number; d: number } };
};

function runSelfplay(args: Args): Summary {
  const engineA: EngineConfig = {
    name: `A(d=${args.depthA}${args.timeAMs ? `,t=${args.timeAMs}ms` : ''}${describeOpts(args.optsA)})`,
    depth: args.depthA,
    timeBudgetMs: args.timeAMs,
    opts: args.optsA,
  };
  const engineB: EngineConfig = {
    name: `B(d=${args.depthB}${args.timeBMs ? `,t=${args.timeBMs}ms` : ''}${describeOpts(args.optsB)})`,
    depth: args.depthB,
    timeBudgetMs: args.timeBMs,
    opts: args.optsB,
  };

  const summary: Summary = {
    games: 0,
    aWins: 0,
    bWins: 0,
    draws: 0,
    aWinRate: 0,
    drawRate: 0,
    avgTurns: 0,
    avgDurationMs: 0,
    avgActions: 0,
    byReason: {},
    byAside: {
      p1: { a: 0, b: 0, d: 0 },
      p2: { a: 0, b: 0, d: 0 },
    },
  };

  let totalTurns = 0;
  let totalDuration = 0;
  let totalActions = 0;

  for (let i = 0; i < args.games; i++) {
    const aSide: Player = args.swap && i % 2 === 1 ? 'p2' : 'p1';
    const gameSeed = args.seed * 1_000_000 + i;
    const res = playGame(engineA, engineB, aSide, gameSeed, args.maxTurns);

    if (res.winner === 'A') summary.aWins++;
    else if (res.winner === 'B') summary.bWins++;
    else summary.draws++;

    summary.byReason[res.reason] = (summary.byReason[res.reason] ?? 0) + 1;
    const side = aSide === 'p1' ? summary.byAside.p1 : summary.byAside.p2;
    if (res.winner === 'A') side.a++;
    else if (res.winner === 'B') side.b++;
    else side.d++;

    totalTurns += res.turns;
    totalDuration += res.durationMs;
    totalActions += res.actions;
    summary.games++;

    if (!args.quiet) {
      const winner = res.winner === 'draw' ? '— ' : res.winner;
      process.stdout.write(
        `[${String(i + 1).padStart(3)}/${args.games}] A=${aSide.toUpperCase()} ` +
        `winner=${winner} reason=${res.reason.padEnd(15)} turns=${String(res.turns).padStart(3)} ` +
        `${(res.durationMs / 1000).toFixed(1)}s\n`,
      );
    }
  }

  summary.aWinRate = summary.aWins / summary.games;
  summary.drawRate = summary.draws / summary.games;
  summary.avgTurns = totalTurns / summary.games;
  summary.avgDurationMs = totalDuration / summary.games;
  summary.avgActions = totalActions / summary.games;

  return summary;
}

// ─── Reporting ─────────────────────────────────────────────────────────────

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function printSummary(args: Args, s: Summary): void {
  const engineA = `A: depth=${args.depthA}${args.timeAMs ? `, time=${args.timeAMs}ms` : ''}${describeOpts(args.optsA)}`;
  const engineB = `B: depth=${args.depthB}${args.timeBMs ? `, time=${args.timeBMs}ms` : ''}${describeOpts(args.optsB)}`;
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' Skyflag self-play summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` ${engineA}`);
  console.log(` ${engineB}`);
  console.log(` games=${s.games}  seed=${args.seed}  swap=${args.swap ? 'on' : 'off'}  max-turns=${args.maxTurns}`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(` A wins:       ${String(s.aWins).padStart(4)}   ${pct(s.aWins / s.games)}`);
  console.log(` B wins:       ${String(s.bWins).padStart(4)}   ${pct(s.bWins / s.games)}`);
  console.log(` Draws:        ${String(s.draws).padStart(4)}   ${pct(s.draws / s.games)}`);
  console.log(` A score:      ${pct((s.aWins + s.draws * 0.5) / s.games)}  (wins + 0.5*draws)`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(` Avg turns/game:   ${s.avgTurns.toFixed(1)}`);
  console.log(` Avg actions/game: ${s.avgActions.toFixed(1)}`);
  console.log(` Avg duration:     ${(s.avgDurationMs / 1000).toFixed(2)}s`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(' End reasons:');
  for (const [reason, count] of Object.entries(s.byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${reason.padEnd(18)} ${String(count).padStart(4)}   ${pct(count / s.games)}`);
  }
  console.log('───────────────────────────────────────────────────────────');
  console.log(' By A-side (sanity-check no side-bias):');
  console.log(`   A as P1: ${s.byAside.p1.a}-${s.byAside.p1.b}-${s.byAside.p1.d} (A-B-D)`);
  console.log(`   A as P2: ${s.byAside.p2.a}-${s.byAside.p2.b}-${s.byAside.p2.d} (A-B-D)`);
  console.log('═══════════════════════════════════════════════════════════');
}

// ─── Main ──────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
console.log(`Running ${args.games} games: A(d=${args.depthA}) vs B(d=${args.depthB}), seed=${args.seed}`);
const summary = runSelfplay(args);
printSummary(args, summary);
