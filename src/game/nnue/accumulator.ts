// Incremental NNUE accumulator.
//
// The dominant per-node cost of the learned evaluator is the hidden-1
// projection: for every searched position forwardP1() scans all
// INPUT_DIM features and does an H1×nnz multiply-accumulate. But a single
// move changes only a handful of features, so the hidden-1 PRE-activation
//
//     acc[h] = b1[h] + Σ_j W1[h][j]·x[j]
//
// can be carried down the search and patched per move:
//
//     acc[h] += Σ_{changed j} W1[h][j]·(newVal_j − oldVal_j)
//
// instead of recomputed from scratch. That is what makes a net cheap
// enough per node that depth is not sacrificed (the binding constraint
// the M2 depth-parity result identified).
//
// The math mirrors net.ts forwardP1 EXACTLY; the only difference vs a
// from-scratch recompute is floating-point summation order (observed
// ≪ 1e-6, vs alpha-beta score margins many orders larger). The parity
// harness (scripts/nnue-accum-parity.ts) is the correctness gate and
// must pass before this is wired into minimax/quiescence.
//
// The search reducer is immutable (reduce() returns a fresh state, no
// make/unmake), so there is no in-place "unmake": each node threads its
// own child accumulator (childAccumulator) and the parent's is preserved
// naturally by the call stack.

import type { GameState, Player } from '../types';
import type { NetWeights } from './net';
import { encodeSparse } from './encode';
import { evaluate } from '../ai';

/** Hidden-1 pre-activation vector. Length = net.b1.length (H1). */
export type Accumulator = Float64Array;

/** Full recompute from a position — the correctness reference. */
export function refreshAccumulator(net: NetWeights, state: GameState): Accumulator {
  const H1 = net.b1.length;
  const acc = new Float64Array(H1);
  for (let h = 0; h < H1; h++) acc[h] = net.b1[h];
  const { index, value } = encodeSparse(state);
  for (let k = 0; k < index.length; k++) {
    const j = index[k];
    const v = value[k];
    for (let h = 0; h < H1; h++) acc[h] += net.W1[h][j] * v;
  }
  return acc;
}

export type FeatureDelta = ReadonlyArray<{ index: number; delta: number }>;

/**
 * Exact per-feature value change between two positions, derived from the
 * sparse encodings (the single source of truth in encode.ts). Crucially
 * this captures features whose VALUE changes — in-hand counts (0.25·n)
 * and the activations scalar (0/0.5/1) — not just presence; a naive
 * added/removed-index diff would silently corrupt those.
 */
export function featureDelta(prev: GameState, next: GameState): FeatureDelta {
  const a = encodeSparse(prev);
  const b = encodeSparse(next);
  const m = new Map<number, number>();
  for (let k = 0; k < a.index.length; k++) m.set(a.index[k], -a.value[k]);
  for (let k = 0; k < b.index.length; k++) {
    m.set(b.index[k], (m.get(b.index[k]) ?? 0) + b.value[k]);
  }
  const out: { index: number; delta: number }[] = [];
  for (const [index, delta] of m) if (delta !== 0) out.push({ index, delta });
  return out;
}

/** In-place acc ← acc + Σ W1[:,j]·delta_j. */
export function applyDelta(
  acc: Accumulator,
  net: NetWeights,
  delta: FeatureDelta,
): void {
  const H1 = net.b1.length;
  const W1 = net.W1;
  for (const { index, delta: d } of delta) {
    for (let h = 0; h < H1; h++) acc[h] += W1[h][index] * d;
  }
}

/** Fresh child accumulator for `next`, leaving `parent` untouched. */
export function childAccumulator(
  parent: Accumulator,
  net: NetWeights,
  prev: GameState,
  next: GameState,
): Accumulator {
  const child = parent.slice();
  applyDelta(child, net, featureDelta(prev, next));
  return child;
}

/**
 * Raw P1-perspective score from a maintained accumulator. Mirrors
 * net.ts forwardP1's tail exactly: ReLU(acc) → W2 → ReLU → W3 →
 * un-standardise.
 */
export function forwardFromAccumulator(
  net: NetWeights,
  acc: Accumulator,
): number {
  const { W2, b2, W3, b3 } = net;
  const H1 = net.b1.length;
  const H2 = b2.length;

  const a1 = new Float64Array(H1);
  for (let h = 0; h < H1; h++) {
    const v = acc[h];
    a1[h] = v > 0 ? v : 0;
  }
  const a2 = new Float64Array(H2);
  for (let h = 0; h < H2; h++) {
    let s = b2[h];
    const w = W2[h];
    for (let j = 0; j < H1; j++) s += w[j] * a1[j];
    a2[h] = s > 0 ? s : 0;
  }
  let o = b3;
  for (let h = 0; h < H2; h++) o += W3[h] * a2[h];
  return o * net.norm.targetStd + net.norm.targetMean;
}

/**
 * Drop-in Evaluator (ai.ts contract) given a maintained accumulator for
 * `state`. Terminal positions delegate to the hand evaluate() exactly
 * like makeNetEvaluator, so ±WIN_SCORE outcomes stay exact.
 */
export function evalFromAccumulator(
  net: NetWeights,
  acc: Accumulator,
  state: GameState,
  aiPlayer: Player,
): number {
  if (state.status.kind !== 'in-progress') return evaluate(state, aiPlayer);
  const p1 = forwardFromAccumulator(net, acc);
  return aiPlayer === 'p1' ? p1 : -p1;
}
