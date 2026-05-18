// Correctness gate for the incremental NNUE accumulator (src/game/nnue/
// accumulator.ts) and the encoder refactor (encode.ts encodeSparse /
// encodeState). MUST pass before the accumulator is wired into the hot
// search path.
//
// Three invariants, checked at every position of many random legal
// playouts, with a freshly randomised net of the production shape:
//
//   1. BYTE-IDENTITY: encodeState() == the pre-refactor dense encoder
//      (extracted from git into encode.ref.ts). Proves the "model-
//      breaking layout change" warning in encode.ts is not tripped —
//      existing trained nets / the trainer still see the same features.
//   2. ACCUMULATOR PARITY: the incrementally threaded accumulator
//      (childAccumulator from the initial position along the move
//      sequence) == a from-scratch refreshAccumulator() of the same
//      position. Difference is pure fp summation order.
//   3. EVALUATOR PARITY: evalFromAccumulator(threaded) == the shipped
//      makeNetEvaluator() (full contract: terminal delegation +
//      p1/p2 perspective), for both aiPlayer values.
//
// Run: npm run nnue:parity   (optionally: -- --games 300 --seed 7)

import { createInitialGameState } from '../src/game/constants';
import { reduce } from '../src/game/reducer';
import { legalActions } from '../src/game/ai';
import { encodeState, INPUT_DIM } from '../src/game/nnue/encode';
import { encodeState as encodeRef } from '../src/game/nnue/encode.ref';
import { makeNetEvaluator, type NetWeights } from '../src/game/nnue/net';
import {
  refreshAccumulator,
  childAccumulator,
  evalFromAccumulator,
} from '../src/game/nnue/accumulator';

// ── args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argNum = (flag: string, def: number) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] != null ? Number(argv[i + 1]) : def;
};
const GAMES = argNum('--games', 200);
const SEED = argNum('--seed', 1);
const MAX_PLIES = argNum('--max-plies', 240);
const TOL = argNum('--tol', 1e-6);

// ── seeded RNG (mulberry32) ───────────────────────────────────────────────
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── random net of the production shape ────────────────────────────────────
function randomNet(rand: () => number, h1 = 64, h2 = 16): NetWeights {
  const u = () => (rand() - 0.5) * 0.2; // ~U(-0.1, 0.1)
  const vec = (n: number) => Array.from({ length: n }, u);
  const mat = (r: number, c: number) => Array.from({ length: r }, () => vec(c));
  return {
    arch: { inputDim: INPUT_DIM, h1, h2 },
    norm: { targetMean: 5, targetStd: 350, clamp: 2000 },
    W1: mat(h1, INPUT_DIM),
    b1: vec(h1),
    W2: mat(h2, h1),
    b2: vec(h2),
    W3: vec(h2),
    b3: u(),
  };
}

// ── run ───────────────────────────────────────────────────────────────────
const rand = rng(SEED);
const net = randomNet(rand);
const netEval = makeNetEvaluator(net);

let positions = 0;
let byteMismatches = 0;
let maxAccErr = 0;
let maxEvalErr = 0;

const maxAbsDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
};

for (let g = 0; g < GAMES; g++) {
  let state = createInitialGameState();
  let acc = refreshAccumulator(net, state);

  for (let ply = 0; ply < MAX_PLIES; ply++) {
    positions++;

    // 1. byte-identity of the encoder
    const x = encodeState(state);
    const xRef = encodeRef(state);
    if (x.length !== xRef.length) byteMismatches++;
    else
      for (let i = 0; i < x.length; i++)
        if (x[i] !== xRef[i]) {
          byteMismatches++;
          break;
        }

    // 2. incremental vs from-scratch accumulator
    const fresh = refreshAccumulator(net, state);
    maxAccErr = Math.max(maxAccErr, maxAbsDiff(acc, fresh));

    // 3. full-contract evaluator parity, both perspectives
    for (const ai of ['p1', 'p2'] as const) {
      const ref = netEval(state, ai);
      const inc = evalFromAccumulator(net, acc, state, ai);
      maxEvalErr = Math.max(maxEvalErr, Math.abs(ref - inc));
    }

    if (state.status.kind !== 'in-progress') break;
    const acts = legalActions(state);
    if (acts.length === 0) break;
    const action = acts[Math.floor(rand() * acts.length)];
    const next = reduce(state, action);
    acc = childAccumulator(acc, net, state, next);
    state = next;
  }
}

const pass = byteMismatches === 0 && maxAccErr <= TOL && maxEvalErr <= TOL;

console.log('── NNUE accumulator parity ──────────────────────────────');
console.log(`games            ${GAMES}  (seed ${SEED})`);
console.log(`positions checked ${positions}`);
console.log(`encoder byte-identity mismatches  ${byteMismatches}   (must be 0)`);
console.log(`max accumulator abs error         ${maxAccErr.toExponential(3)}`);
console.log(`max evaluator  abs error          ${maxEvalErr.toExponential(3)}`);
console.log(`tolerance                         ${TOL.toExponential(3)}`);
console.log(pass ? '✓ PASS' : '✗ FAIL');
process.exitCode = pass ? 0 : 1;
