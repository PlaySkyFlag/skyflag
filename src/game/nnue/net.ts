// Learned-evaluator inference. Pure (no fs) so it works in the browser
// engine and in Node scripts alike; callers pass an already-parsed net
// object. Mirrors the encoder's P1-perspective contract.
//
// Architecture matches scripts/nnue-train.ts: sparse input → W1/b1 →
// ReLU → W2/b2 → ReLU → W3/b3 → scalar (standardised), then
// un-standardised back to eval units.

import type { GameState, Player } from '../types';
import { evaluate } from '../ai';
import { encodeState } from './encode';

export type NetWeights = {
  arch: { inputDim: number; h1: number; h2: number };
  norm: { targetMean: number; targetStd: number; clamp: number };
  W1: number[][]; b1: number[];
  W2: number[][]; b2: number[];
  W3: number[]; b3: number;
};

/** Raw P1-perspective score (eval units), no terminal handling. */
function forwardP1(net: NetWeights, x: Float32Array): number {
  const { W1, b1, W2, b2, W3, b3 } = net;
  const H1 = b1.length;
  const H2 = b2.length;

  // Collect nonzeros once (input is ~40-sparse of 880).
  const nz: number[] = [];
  const nzv: number[] = [];
  for (let j = 0; j < x.length; j++) {
    if (x[j] !== 0) { nz.push(j); nzv.push(x[j]); }
  }

  const a1 = new Float64Array(H1);
  for (let h = 0; h < H1; h++) {
    let acc = b1[h];
    const w = W1[h];
    for (let k = 0; k < nz.length; k++) acc += w[nz[k]] * nzv[k];
    a1[h] = acc > 0 ? acc : 0;
  }
  const a2 = new Float64Array(H2);
  for (let h = 0; h < H2; h++) {
    let acc = b2[h];
    const w = W2[h];
    for (let j = 0; j < H1; j++) acc += w[j] * a1[j];
    a2[h] = acc > 0 ? acc : 0;
  }
  let o = b3;
  for (let h = 0; h < H2; h++) o += W3[h] * a2[h];
  return o * net.norm.targetStd + net.norm.targetMean;
}

/**
 * Build a drop-in evaluator with the same contract as ai.ts evaluate():
 * score from `aiPlayer`'s perspective, higher = better for aiPlayer.
 * Terminal / decided positions delegate to the hand evaluator so
 * ±WIN_SCORE outcomes stay exact (the net is a positional judge, not a
 * mate detector).
 */
export function makeNetEvaluator(
  net: NetWeights,
): (state: GameState, aiPlayer: Player) => number {
  return (state, aiPlayer) => {
    if (state.status.kind !== 'in-progress') {
      return evaluate(state, aiPlayer);
    }
    const p1 = forwardP1(net, encodeState(state));
    return aiPlayer === 'p1' ? p1 : -p1;
  };
}
