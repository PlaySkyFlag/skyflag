/*
 * Feature-extracting Texel eval tuner.
 *
 * Fits the evaluation weights (src/game/ai.ts EvalParams) to predict
 * self-play outcomes — the classic Texel method, the pragmatic lever
 * for "depth doesn't translate to strength" (eval calibration, not
 * more search).
 *
 * Pipeline:
 *   1. selfplay --record (ideally --bal) → JSONL of {r,stm,ply,state}.
 *      r = game result from P1's view (1 win / 0.5 draw / 0 loss).
 *   2. THIS script streams that file. For each in-progress position it
 *      calls the REAL evaluate() from P1's view at the current params
 *      (`base`), then perturbs each tuned param by a finite step to get
 *      that param's exact partial slope `f_j`. It keeps only the
 *      compact row {y, base, f[]} — the 26 KB state is discarded, so
 *      memory stays flat no matter how huge the dataset.
 *   3. Logistic fit: P(P1 win) = sigmoid(beta*base + Σ_j theta_j f_j).
 *      Recover K=beta and Δparam_j = theta_j / beta; tuned param =
 *      p0_j + Δparam_j. Report loss before/after and write the params.
 *
 * Exactness / the one caveat: every param enters evaluate() affinely
 * EXCEPT the pair (material.* × threatFrac) — the threat term is
 * value*threatFrac. So per-coordinate slopes are exact, but the joint
 * linear model has a small bilinear error if you tune a material value
 * AND threatFrac together. `--passes N` re-extracts at the updated
 * params and refits (block-coordinate), driving that error to zero.
 * Default is 1 pass (single file stream — fast, the core deliverable).
 *
 * Loss going down is NECESSARY, not sufficient. Strength must be
 * confirmed head-to-head with the selfplay harness as referee — see
 * the printed next-step. Do not ship tuned params on loss alone.
 *
 * Run:
 *   npm run texel -- --data data/selfplay.jsonl
 *   npm run texel -- --data data/selfplay.jsonl --passes 3 --out data/tuned.json
 *   npm run texel -- --data data/selfplay.jsonl --params captain,soldier,mobilityW,flagBonus
 */

import { createReadStream, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import {
  evaluate,
  setEvalParams,
  DEFAULT_EVAL_PARAMS,
  type EvalParams,
} from '../src/game/ai';
import type { GameState } from '../src/game/types';

// ─── Tunable param addressing ──────────────────────────────────────────────
// Scalars by key; the four material values as material.<kind>.

const MATERIAL_KINDS = ['captain', 'soldier', 'rover', 'pilot'] as const;
const SCALAR_KEYS = [
  'inHandDiscount', 'flagBonus', 'finalFlagRush', 'distW', 'mobilityW',
  'threatFrac', 'forkPerAttacker', 'captainThreat', 'captainForkPer',
  'multiCaptain', 'liftPair', 'shelterPer', 'flagThreat2ply', 'pstScale',
] as const;

// Every tunable key, for --params validation.
const ALL_KEYS = new Set<string>([
  ...MATERIAL_KINDS.map((k) => `material.${k}`),
  ...SCALAR_KEYS,
]);

// Curated default set: highest-leverage, low-noise. The rare-trigger
// fork/multi-captain terms are opt-in via --params.
const DEFAULT_PARAMS = [
  'material.captain', 'material.soldier', 'material.rover', 'material.pilot',
  'inHandDiscount', 'flagBonus', 'finalFlagRush', 'distW', 'mobilityW',
  'threatFrac', 'captainThreat', 'liftPair', 'shelterPer', 'flagThreat2ply',
  'pstScale',
];

function getParam(p: EvalParams, key: string): number {
  if (key.startsWith('material.')) {
    return p.material[key.slice(9) as (typeof MATERIAL_KINDS)[number]];
  }
  return p[key as (typeof SCALAR_KEYS)[number]];
}

function withParam(p: EvalParams, key: string, value: number): EvalParams {
  const next: EvalParams = { ...p, material: { ...p.material } };
  if (key.startsWith('material.')) {
    next.material[key.slice(9) as (typeof MATERIAL_KINDS)[number]] = value;
  } else {
    (next as Record<string, number>)[key] = value;
  }
  return next;
}

// ─── Args ──────────────────────────────────────────────────────────────────

type Args = {
  data: string;
  params: string[];
  out: string;
  passes: number;
  iters: number;
  lr: number;
  l2: number;
  limit: number;
};

function parseArgs(argv: string[]): Args {
  const a: Args = {
    data: '',
    params: DEFAULT_PARAMS,
    out: 'data/tuned-params.json',
    passes: 1,
    iters: 4000,
    lr: 0.05,
    l2: 1e-4,
    limit: Infinity,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--data':   a.data = v; i++; break;
      case '--params': a.params = v.split(',').map((s) => s.trim()).filter(Boolean); i++; break;
      case '--out':    a.out = v; i++; break;
      case '--passes': a.passes = Math.max(1, parseInt(v, 10)); i++; break;
      case '--iters':  a.iters = parseInt(v, 10); i++; break;
      case '--lr':     a.lr = parseFloat(v); i++; break;
      case '--l2':     a.l2 = parseFloat(v); i++; break;
      case '--limit':  a.limit = parseInt(v, 10); i++; break;
      case '--help': case '-h':
        console.log('texel --data FILE [--params a,b,...] [--out FILE] [--passes N] [--iters N] [--lr F] [--l2 F] [--limit N]');
        process.exit(0);
    }
  }
  if (!a.data) { console.error('--data <jsonl> is required'); process.exit(1); }
  const bad = a.params.filter((k) => !ALL_KEYS.has(k));
  if (bad.length) {
    console.error(`Unknown --params: ${bad.join(', ')}`);
    console.error(`Known keys: ${[...ALL_KEYS].join(', ')}`);
    process.exit(1);
  }
  return a;
}

// ─── Streaming feature extraction ───────────────────────────────────────────
// One pass over the file at param vector p0. Per in-progress position:
// base = evaluate(p0); f_j = (evaluate(p0 with key_j bumped) - base)/δ.
// The state is dropped immediately; only {y, base, f[]} is retained.

type Rows = { y: Float64Array; base: Float64Array; F: Float64Array[]; n: number };

async function extract(file: string, keys: string[], p0: EvalParams, limit: number): Promise<Rows> {
  // Per-key finite step. eval is affine in each param, so the slope is
  // exact for any step; pick one comfortably clear of zero.
  const step = keys.map((key) => {
    const v = Math.abs(getParam(p0, key));
    return Math.max(v * 0.05, 0.5);
  });

  const ys: number[] = [];
  const bases: number[] = [];
  const cols: number[][] = keys.map(() => []);
  let metaWarned = false;

  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length === 0) continue;
    if (line.startsWith('{"_meta"')) {
      try {
        const m = JSON.parse(line)._meta;
        const sp: string[] = m?.selfplayArgs ?? [];
        if (!sp.includes('--bal') && !metaWarned) {
          console.warn(
            'WARN: dataset _meta has no --bal. The tuner evaluates with ' +
            'balanced stance; for clean labels regenerate with --bal.',
          );
          metaWarned = true;
        }
      } catch { /* ignore */ }
      continue;
    }
    if (ys.length >= limit) break;

    let row: { r: number; state: GameState };
    try { row = JSON.parse(line); } catch { continue; }
    const st = row.state;
    // Only quiet, undecided positions teach the eval anything.
    if (!st || st.status?.kind !== 'in-progress') continue;

    setEvalParams(p0);
    const base = evaluate(st, 'p1');
    if (!Number.isFinite(base)) continue;

    const f = new Array<number>(keys.length);
    let ok = true;
    for (let j = 0; j < keys.length; j++) {
      setEvalParams(withParam(p0, keys[j], getParam(p0, keys[j]) + step[j]));
      const e = evaluate(st, 'p1');
      if (!Number.isFinite(e)) { ok = false; break; }
      f[j] = (e - base) / step[j];
    }
    setEvalParams(p0);
    if (!ok) continue;

    ys.push(row.r);
    bases.push(base);
    for (let j = 0; j < keys.length; j++) cols[j].push(f[j]);
  }

  const n = ys.length;
  return {
    y: Float64Array.from(ys),
    base: Float64Array.from(bases),
    F: cols.map((c) => Float64Array.from(c)),
    n,
  };
}

// ─── Logistic fit ───────────────────────────────────────────────────────────
// Standardized features [base, f_1..f_m]; predict y = sigmoid(a + Σ w_k x_k).
// Baseline = the current eval recalibrated (only `base` active); the
// improvement over THAT (not over an untuned constant) is the honest
// signal that reweighting actually helped. Recover K = coef(base);
// Δparam_j = coef(f_j) / K, then unstandardize to engine units.

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function logloss(n: number, X: Float64Array[], y: Float64Array, a: number, w: number[]): number {
  let s = 0;
  for (let i = 0; i < n; i++) {
    let z = a;
    for (let k = 0; k < X.length; k++) z += w[k] * X[k][i];
    const p = sigmoid(z);
    s += -(y[i] * Math.log(p + 1e-12) + (1 - y[i]) * Math.log(1 - p + 1e-12));
  }
  return s / n;
}

// Adam logistic fit over standardized columns. `active[k] === false`
// pins column k's weight to 0 (used for the base-only baseline).
function adam(
  n: number, X: Float64Array[], y: Float64Array,
  active: boolean[], iters: number, lr: number, l2: number,
): { a: number; w: number[] } {
  const m1 = X.length;
  let a = 0;
  const w = new Array(m1).fill(0);
  const mW = new Array(m1).fill(0), vW = new Array(m1).fill(0);
  let mA = 0, vA = 0;
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (let t = 1; t <= iters; t++) {
    let ga = 0;
    const gw = new Array(m1).fill(0);
    for (let i = 0; i < n; i++) {
      let z = a;
      for (let k = 0; k < m1; k++) z += w[k] * X[k][i];
      const d = sigmoid(z) - y[i];
      ga += d;
      for (let k = 0; k < m1; k++) if (active[k]) gw[k] += d * X[k][i];
    }
    ga /= n;
    mA = b1 * mA + (1 - b1) * ga; vA = b2 * vA + (1 - b2) * ga * ga;
    a -= lr * (mA / (1 - b1 ** t)) / (Math.sqrt(vA / (1 - b2 ** t)) + eps);
    for (let k = 0; k < m1; k++) {
      if (!active[k]) continue;
      const g = gw[k] / n + l2 * w[k];
      mW[k] = b1 * mW[k] + (1 - b1) * g;
      vW[k] = b2 * vW[k] + (1 - b2) * g * g;
      w[k] -= lr * (mW[k] / (1 - b1 ** t)) / (Math.sqrt(vW[k] / (1 - b2 ** t)) + eps);
    }
  }
  return { a, w };
}

function fit(rows: Rows, keys: string[], p0: EvalParams, iters: number, lr: number, l2: number) {
  const raw = [rows.base, ...rows.F]; // column 0 = base, then one per tuned param
  const m1 = raw.length;
  const mu = new Array(m1).fill(0);
  const sd = new Array(m1).fill(1);
  for (let k = 0; k < m1; k++) {
    let s = 0; for (let i = 0; i < rows.n; i++) s += raw[k][i];
    mu[k] = s / rows.n;
    let v = 0; for (let i = 0; i < rows.n; i++) { const d = raw[k][i] - mu[k]; v += d * d; }
    sd[k] = Math.sqrt(v / rows.n) || 1;
  }
  const X = raw.map((col, k) => {
    const out = new Float64Array(rows.n);
    for (let i = 0; i < rows.n; i++) out[i] = (col[i] - mu[k]) / sd[k];
    return out;
  });

  // Baseline: recalibrate the current eval (only `base` active).
  const baseMask = X.map((_, k) => k === 0);
  const b = adam(rows.n, X, rows.y, baseMask, iters, lr, l2);
  const lossBefore = logloss(rows.n, X, rows.y, b.a, b.w);

  // Full fit: all columns active.
  const allMask = X.map(() => true);
  const f = adam(rows.n, X, rows.y, allMask, iters, lr, l2);
  const lossAfter = logloss(rows.n, X, rows.y, f.a, f.w);

  // Unstandardize: raw-space coef = w/sd. K = coefficient on `base`.
  const wraw = f.w.map((wk, k) => wk / sd[k]);
  const K = wraw[0];
  const tuned: EvalParams = { ...p0, material: { ...p0.material } };
  const deltas: Record<string, { from: number; to: number }> = {};
  for (let j = 0; j < keys.length; j++) {
    const dp = K !== 0 ? wraw[j + 1] / K : 0;
    const from = getParam(p0, keys[j]);
    const to = from + dp;
    Object.assign(tuned, withParam(tuned, keys[j], to));
    deltas[keys[j]] = { from, to };
  }

  return { tuned, K, deltas, lossBefore, lossAfter };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const keys = args.params;
  console.log(`Tuning ${keys.length} params over ${args.passes} pass(es): ${keys.join(', ')}`);

  let p0: EvalParams = { ...DEFAULT_EVAL_PARAMS, material: { ...DEFAULT_EVAL_PARAMS.material } };
  let lossStart = NaN;
  let lossEnd = NaN;
  let K = NaN;
  let deltas: Record<string, { from: number; to: number }> = {};

  for (let pass = 0; pass < args.passes; pass++) {
    process.stdout.write(`\nPass ${pass + 1}/${args.passes}: extracting…\n`);
    const rows = await extract(args.data, keys, p0, args.limit);
    if (rows.n === 0) { console.error('No usable positions extracted.'); process.exit(1); }
    process.stdout.write(`  ${rows.n.toLocaleString()} positions, fitting…\n`);

    const r = fit(rows, keys, p0, args.iters, args.lr, args.l2);
    // lossBefore = current eval recalibrated; lossAfter = reweighted.
    if (pass === 0) lossStart = r.lossBefore;
    lossEnd = r.lossAfter;
    K = r.K;
    deltas = r.deltas;
    p0 = r.tuned;
    process.stdout.write(
      `  recalibrated ${r.lossBefore.toFixed(5)} → reweighted ${r.lossAfter.toFixed(5)}` +
      `  (K=${r.K.toFixed(5)})\n`,
    );
  }

  console.log('\n── Tuned params (old → new) ──────────────────────────');
  for (const k of keys) {
    const d = deltas[k];
    console.log(`  ${k.padEnd(20)} ${d.from.toFixed(3).padStart(10)} → ${d.to.toFixed(3)}`);
  }
  console.log('──────────────────────────────────────────────────────');
  console.log(` logloss ${lossStart.toFixed(5)} → ${lossEnd.toFixed(5)}  (lower = better fit)`);

  // K is the coefficient on the current eval (`base`); it must be
  // clearly positive (better eval ⇒ higher P1-win probability). K ≤ 0
  // or absurd Δs mean the fit is degenerate — almost always too few or
  // too-correlated positions (e.g. a handful of shallow games). The
  // tuned numbers are then meaningless; don't trust or ship them.
  const degenerate = !(K > 1e-6);
  if (degenerate) {
    console.log('');
    console.log(' ⚠️  DEGENERATE FIT (K ≤ 0). The dataset is too small or too');
    console.log('     correlated — tuned params are NOT usable. Generate a');
    console.log('     large, decorrelated set first, e.g.:');
    console.log('     npm run selfplay:shards -- --games 40000 --bal \\');
    console.log('       --depth-a 4 --depth-b 4 --record-min-turn 4 \\');
    console.log('       --record-stride 6 --out data/selfplay.jsonl');
  }
  console.log('');
  console.log(' NOTE: lower loss ≠ stronger play. Validate head-to-head:');
  console.log('   (next step) wire setEvalParams into selfplay, then');
  console.log('   npm run selfplay -- --games 400 --bal  (tuned A vs default B)');

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(
    args.out,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        dataset: args.data,
        params: keys,
        passes: args.passes,
        K,
        degenerate,
        loglossBefore: lossStart,
        loglossAfter: lossEnd,
        tuned: p0,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\nWrote ${args.out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
