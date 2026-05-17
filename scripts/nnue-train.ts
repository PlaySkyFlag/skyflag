/**
 * nnue-train — milestone-1 go/no-go for the learned evaluator.
 *
 * Trains a small MLP to predict the deep-search teacher score `ds`
 * (from label-deep) from the shared board encoding. The question this
 * answers: can a NET fit the deep target far better than the linear
 * 15-feature eval did (R²=0.035)? If yes, the representation was the
 * bottleneck and Option A is worth integrating. If it's still ~0.035,
 * the deep target itself isn't separable from board features — pivot.
 *
 * Pure TypeScript, no ML dependency (keeps the Vite/Capacitor stack
 * clean). Input is sparse (~40 nonzeros of 1744), so the matmuls are
 * cheap even in JS.
 *
 *   npm run nnue-train -- --data data/deep.jsonl --out data/net.json \
 *     [--epochs 60] [--batch 128] [--lr 0.001] [--h1 64] [--h2 16] \
 *     [--clamp 2000] [--limit N] [--val 0.15] [--seed 1]
 */
import { createReadStream, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { encodeState, INPUT_DIM } from '../src/game/nnue/encode';
import type { GameState } from '../src/game/types';

type Args = {
  data: string; out: string;
  epochs: number; batch: number; lr: number;
  h1: number; h2: number; clamp: number;
  limit: number; val: number; seed: number;
};

function parseArgs(argv: string[]): Args {
  const a: Args = {
    data: '', out: 'data/net.json',
    epochs: 60, batch: 128, lr: 1e-3,
    h1: 64, h2: 16, clamp: 2000,
    limit: Infinity, val: 0.15, seed: 1,
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    switch (argv[i]) {
      case '--data':   a.data = v; i++; break;
      case '--out':    a.out = v; i++; break;
      case '--epochs': a.epochs = parseInt(v, 10); i++; break;
      case '--batch':  a.batch = parseInt(v, 10); i++; break;
      case '--lr':     a.lr = parseFloat(v); i++; break;
      case '--h1':     a.h1 = parseInt(v, 10); i++; break;
      case '--h2':     a.h2 = parseInt(v, 10); i++; break;
      case '--clamp':  a.clamp = parseFloat(v); i++; break;
      case '--limit':  a.limit = parseInt(v, 10); i++; break;
      case '--val':    a.val = parseFloat(v); i++; break;
      case '--seed':   a.seed = parseInt(v, 10); i++; break;
      case '--help': case '-h':
        console.log('nnue-train --data FILE --out FILE [--epochs N] [--batch N] [--lr F] [--h1 N] [--h2 N] [--clamp F] [--limit N] [--val F] [--seed N]');
        process.exit(0);
    }
  }
  if (!a.data) { console.error('--data <jsonl> is required'); process.exit(1); }
  return a;
}

// Deterministic RNG so train/val split and init are reproducible.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Sample = { nz: number[]; nzv: number[]; y: number };

async function load(file: string, clamp: number, limit: number): Promise<Sample[]> {
  const out: Sample[] = [];
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length === 0 || line.startsWith('{"_meta"')) continue;
    if (out.length >= limit) break;
    let row: { ds?: number; state: GameState };
    try { row = JSON.parse(line); } catch { continue; }
    if (row.ds === undefined || !Number.isFinite(row.ds) || !row.state) continue;
    const x = encodeState(row.state);
    const nz: number[] = [];
    const nzv: number[] = [];
    for (let j = 0; j < x.length; j++) if (x[j] !== 0) { nz.push(j); nzv.push(x[j]); }
    const y = Math.max(-clamp, Math.min(clamp, row.ds));
    out.push({ nz, nzv, y });
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rng = mulberry32(args.seed);

  console.log(`Loading ${args.data} (clamp ±${args.clamp})…`);
  const all = await load(args.data, args.clamp, args.limit);
  if (all.length < 200) {
    console.error(`Only ${all.length} usable samples — need a label-deep'd set with ds. Abort.`);
    process.exit(1);
  }
  // Seeded shuffle, then split.
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const nVal = Math.max(1, Math.floor(all.length * args.val));
  const val = all.slice(0, nVal);
  const tr = all.slice(nVal);
  console.log(`${tr.length} train / ${val.length} val, input dim ${INPUT_DIM}`);

  // Standardise target on the training split.
  let mu = 0; for (const s of tr) mu += s.y; mu /= tr.length;
  let sd = 0; for (const s of tr) sd += (s.y - mu) ** 2; sd = Math.sqrt(sd / tr.length) || 1;
  const ystd = (y: number) => (y - mu) / sd;

  const { h1: H1, h2: H2 } = args;
  // He init.
  const rn = (fan: number) => (rng() * 2 - 1) * Math.sqrt(2 / fan);
  const W1 = Array.from({ length: H1 }, () => Float64Array.from({ length: INPUT_DIM }, () => rn(INPUT_DIM)));
  const b1 = new Float64Array(H1);
  const W2 = Array.from({ length: H2 }, () => Float64Array.from({ length: H1 }, () => rn(H1)));
  const b2 = new Float64Array(H2);
  const W3 = Float64Array.from({ length: H2 }, () => rn(H2));
  let b3 = 0;

  // Adam state.
  const mk2 = (R: number, C: number) => Array.from({ length: R }, () => new Float64Array(C));
  const mW1 = mk2(H1, INPUT_DIM), vW1 = mk2(H1, INPUT_DIM);
  const mb1 = new Float64Array(H1), vb1 = new Float64Array(H1);
  const mW2 = mk2(H2, H1), vW2 = mk2(H2, H1);
  const mb2 = new Float64Array(H2), vb2 = new Float64Array(H2);
  const mW3 = new Float64Array(H2), vW3 = new Float64Array(H2);
  let mb3 = 0, vb3 = 0;
  const b1m = 0.9, b2m = 0.999, eps = 1e-8;
  let step = 0;

  const z1 = new Float64Array(H1), a1 = new Float64Array(H1);
  const z2 = new Float64Array(H2), a2 = new Float64Array(H2);

  function forward(s: Sample): number {
    for (let h = 0; h < H1; h++) {
      let acc = b1[h];
      const w = W1[h];
      for (let k = 0; k < s.nz.length; k++) acc += w[s.nz[k]] * s.nzv[k];
      z1[h] = acc; a1[h] = acc > 0 ? acc : 0;
    }
    for (let h = 0; h < H2; h++) {
      let acc = b2[h];
      const w = W2[h];
      for (let j = 0; j < H1; j++) acc += w[j] * a1[j];
      z2[h] = acc; a2[h] = acc > 0 ? acc : 0;
    }
    let o = b3;
    for (let h = 0; h < H2; h++) o += W3[h] * a2[h];
    return o;
  }

  // Best-val checkpoint — the saved net is the val-R² peak, never the
  // overfit final epoch. Matters for M2 (we hand the engine the best
  // net) and for D/retraining later.
  type Snap = {
    epoch: number; r2: number;
    W1: number[][]; b1: number[]; W2: number[][]; b2: number[];
    W3: number[]; b3: number;
  };
  let best: Snap | null = null;

  for (let epoch = 1; epoch <= args.epochs; epoch++) {
    // Shuffle training order each epoch.
    for (let i = tr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tr[i], tr[j]] = [tr[j], tr[i]];
    }
    let trSE = 0;
    for (let bStart = 0; bStart < tr.length; bStart += args.batch) {
      const batch = tr.slice(bStart, bStart + args.batch);
      // Accumulate grads over the minibatch.
      const gW1 = mk2(H1, INPUT_DIM), gb1 = new Float64Array(H1);
      const gW2 = mk2(H2, H1), gb2 = new Float64Array(H2);
      const gW3 = new Float64Array(H2); let gb3 = 0;
      for (const s of batch) {
        const pred = forward(s);
        const target = ystd(s.y);
        const err = pred - target;            // dL/do  (MSE, std space)
        trSE += (err * sd) ** 2;              // track RMSE in original units
        // Output layer.
        gb3 += err;
        for (let h = 0; h < H2; h++) gW3[h] += err * a2[h];
        // Hidden 2.
        const d2 = new Float64Array(H2);
        for (let h = 0; h < H2; h++) d2[h] = z2[h] > 0 ? err * W3[h] : 0;
        for (let h = 0; h < H2; h++) {
          gb2[h] += d2[h];
          const g = gW2[h];
          for (let j = 0; j < H1; j++) g[j] += d2[h] * a1[j];
        }
        // Hidden 1.
        const d1 = new Float64Array(H1);
        for (let j = 0; j < H1; j++) {
          if (z1[j] <= 0) continue;
          let acc = 0;
          for (let h = 0; h < H2; h++) acc += d2[h] * W2[h][j];
          d1[j] = acc;
        }
        for (let j = 0; j < H1; j++) {
          if (d1[j] === 0) continue;
          gb1[j] += d1[j];
          const g = gW1[j];
          for (let k = 0; k < s.nz.length; k++) g[s.nz[k]] += d1[j] * s.nzv[k];
        }
      }
      // Adam step (gradients are batch sums; scale by 1/|batch|).
      step++;
      const inv = 1 / batch.length;
      const bc1 = 1 - Math.pow(b1m, step);
      const bc2 = 1 - Math.pow(b2m, step);
      const upd = (
        p: Float64Array, g: Float64Array, m: Float64Array, v: Float64Array, n: number,
      ) => {
        for (let i = 0; i < n; i++) {
          const gi = g[i] * inv;
          m[i] = b1m * m[i] + (1 - b1m) * gi;
          v[i] = b2m * v[i] + (1 - b2m) * gi * gi;
          p[i] -= args.lr * (m[i] / bc1) / (Math.sqrt(v[i] / bc2) + eps);
        }
      };
      for (let h = 0; h < H1; h++) upd(W1[h], gW1[h], mW1[h], vW1[h], INPUT_DIM);
      upd(b1, gb1, mb1, vb1, H1);
      for (let h = 0; h < H2; h++) upd(W2[h], gW2[h], mW2[h], vW2[h], H1);
      upd(b2, gb2, mb2, vb2, H2);
      upd(W3, gW3, mW3, vW3, H2);
      {
        const gi = gb3 * inv;
        mb3 = b1m * mb3 + (1 - b1m) * gi;
        vb3 = b2m * vb3 + (1 - b2m) * gi * gi;
        b3 -= args.lr * (mb3 / bc1) / (Math.sqrt(vb3 / bc2) + eps);
      }
    }

    // Val metrics every epoch (cheap; needed to resolve the best
    // checkpoint precisely), original (clamped) units.
    let se = 0, st = 0, my = 0;
    for (const s of val) my += s.y; my /= val.length;
    for (const s of val) {
      const pred = forward(s) * sd + mu;
      se += (pred - s.y) ** 2;
      st += (s.y - my) ** 2;
    }
    const trRMSE = Math.sqrt(trSE / tr.length);
    const valRMSE = Math.sqrt(se / val.length);
    const valR2 = st > 0 ? 1 - se / st : 0;

    if (!best || valR2 > best.r2) {
      best = {
        epoch, r2: valR2,
        W1: W1.map((r) => Array.from(r)), b1: Array.from(b1),
        W2: W2.map((r) => Array.from(r)), b2: Array.from(b2),
        W3: Array.from(W3), b3,
      };
    }
    if (epoch % 5 === 0 || epoch === args.epochs || epoch === 1) {
      console.log(
        `epoch ${String(epoch).padStart(3)}  trRMSE ${trRMSE.toFixed(1)}` +
        `  valRMSE ${valRMSE.toFixed(1)}  valR² ${valR2.toFixed(4)}` +
        (best.epoch === epoch ? '  ★best' : ''),
      );
    }
  }

  if (!best) { console.error('No epochs ran.'); process.exit(1); }
  console.log(
    `\nBest: epoch ${best.epoch}  valR² ${best.r2.toFixed(4)} ` +
    `(saved — not the overfit final epoch)`,
  );

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify({
    arch: { inputDim: INPUT_DIM, h1: H1, h2: H2 },
    norm: { targetMean: mu, targetStd: sd, clamp: args.clamp },
    bestEpoch: best.epoch, valR2: best.r2,
    W1: best.W1, b1: best.b1,
    W2: best.W2, b2: best.b2,
    W3: best.W3, b3: best.b3,
    trained: new Date().toISOString(),
    dataset: args.data,
  }) + '\n');
  console.log(`Wrote ${args.out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
