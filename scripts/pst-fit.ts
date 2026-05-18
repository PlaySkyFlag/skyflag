/*
 * Direct PST redesign — ship-safe, non-NNUE eval lever.
 *
 * Motivation: a prior Texel sign-flip finding (negative pstScale /
 * shelterPer / finalFlagRush *winning* at d3) is strong evidence the
 * shipped PSTs are net-harmful or noisy. The lever is a DIRECT redesign
 * of the per-square tables regressed against a depth-8 teacher label
 * (`ds` from label-deep), NOT more Texel-on-outcome (a proven dead end).
 *
 * Why this is exact (cleaner than texel-tune's finite differences):
 * evaluate()'s PST contribution, from P1's view, is
 *     PST_total = Σ_pieces pstScore(piece) · pstScale · (p1? +1 : −1)
 * and pstScore is just a table-cell lookup with a P2 row-mirror. So with
 * one feature per (kind, layer, P1-perspective row, col) — 4·3·6·6 = 432
 * cells — the model is EXACTLY linear:
 *     eval ≈ baseNoPst + Σ_cell θ_cell · x_cell
 * where x_cell = (#P1 pieces on that cell) − (#P2 pieces whose mirrored
 * square is that cell), and baseNoPst = evaluate() with the PST zeroed.
 * Fitting θ to the teacher is ordinary ridge least squares on the
 * residual t = ds − baseNoPst; θ ARE the redesigned cell values.
 *
 * Honesty gate (mirrors texel-tune): a usable fit must explain a
 * non-trivial slice of the variance AND beat the SHIPPED PST's own
 * teacher-fit error. Otherwise it ships nothing. And — exactly as
 * texel prints — a better teacher fit is NECESSARY, NOT SUFFICIENT:
 * adopt only on a clean, significant d6 head-to-head win.
 *
 * Run:
 *   npm run pst-fit -- --data data/deep.jsonl
 *   npm run pst-fit -- --data data/deep.jsonl --ridge 1e-3 --out data/pst-fitted.json
 */

import { createReadStream, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { evaluate, setEvalParams } from '../src/game/ai';
import { setPstTables, type PstTables } from '../src/game/pst';
import type { GameState, Layer, PieceKind } from '../src/game/types';

const KINDS: PieceKind[] = ['soldier', 'captain', 'rover', 'pilot'];
const LAYERS: Layer[] = ['ground', 'sky', 'space'];
const N_CELL = KINDS.length * LAYERS.length * 6 * 6; // 432

const kIdx = (k: PieceKind) => KINDS.indexOf(k);
const lIdx = (l: Layer) => LAYERS.indexOf(l);
const cellIdx = (k: number, l: number, r: number, c: number) =>
  ((k * LAYERS.length + l) * 6 + r) * 6 + c;

function zeroTables(): PstTables {
  const plane = () =>
    Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  const kind = () => ({ ground: plane(), sky: plane(), space: plane() });
  return { soldier: kind(), captain: kind(), rover: kind(), pilot: kind() };
}

function tablesFromTheta(theta: number[]): PstTables {
  const t = zeroTables();
  for (const k of KINDS)
    for (const l of LAYERS)
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 6; c++)
          t[k][l][r][c] = theta[cellIdx(kIdx(k), lIdx(l), r, c)];
  return t;
}

// ─── Args ──────────────────────────────────────────────────────────────────
type Args = { data: string; out: string; ridge: number; limit: number; clip: number };

function parseArgs(argv: string[]): Args {
  const a: Args = {
    data: 'data/deep.jsonl',
    out: 'data/pst-fitted.json',
    ridge: 1e-3,
    limit: Infinity,
    // Exclude near-terminal blowouts: |ds| beyond this is a won/lost
    // position, not quiet positional judgment, and would swamp the
    // RMSE and distort the cell weights. PSTs only ever matter in
    // non-decided positions. (Matches nnue-train's ±2000 convention.)
    clip: 2000,
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    switch (argv[i]) {
      case '--data': a.data = v; i++; break;
      case '--out': a.out = v; i++; break;
      case '--ridge': a.ridge = parseFloat(v); i++; break;
      case '--limit': a.limit = parseInt(v, 10); i++; break;
      case '--clip': a.clip = parseFloat(v); i++; break;
      case '--help': case '-h':
        console.log('pst-fit [--data FILE] [--out FILE] [--ridge F] [--limit N] [--clip F]');
        process.exit(0);
    }
  }
  return a;
}

// Sparse per-position feature row: the only nonzero cells are squares
// that actually hold a piece (≤10 of 432).
type Row = { idx: number[]; val: number[]; base: number; ds: number; shipped: number };

async function extract(file: string, limit: number, clip: number): Promise<Row[]> {
  const rows: Row[] = [];
  let metaWarned = false;
  let clipped = 0;
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length === 0) continue;
    if (line.startsWith('{"_meta"')) {
      try {
        const sp: string[] = JSON.parse(line)._meta?.selfplayArgs ?? [];
        if (!sp.includes('--bal') && !metaWarned) {
          console.warn(
            'WARN: dataset _meta has no --bal — labels may carry stance noise.',
          );
          metaWarned = true;
        }
      } catch { /* ignore */ }
      continue;
    }
    if (rows.length >= limit) break;

    let row: { ds?: number; state: GameState };
    try { row = JSON.parse(line); } catch { continue; }
    const st = row.state;
    if (!st || st.status?.kind !== 'in-progress') continue;
    if (row.ds === undefined || !Number.isFinite(row.ds)) continue;
    if (Math.abs(row.ds) > clip) { clipped++; continue; }

    // Shipped-PST eval (the real baseline to beat) and PST-zeroed eval
    // (the residual the regression must explain). Default EvalParams.
    setPstTables(null);
    const shipped = evaluate(st, 'p1');
    setPstTables(zeroTables());
    const base = evaluate(st, 'p1');
    if (!Number.isFinite(shipped) || !Number.isFinite(base)) continue;

    // Sparse feature vector: +1 per P1 piece on its square, −1 per P2
    // piece on its row-mirrored square (exactly pstScore·sign).
    const acc = new Map<number, number>();
    for (const bp of st.onBoard) {
      const k = kIdx(bp.piece.kind);
      const l = lIdx(bp.coord.layer);
      const r = bp.piece.owner === 'p1' ? bp.coord.row : 5 - bp.coord.row;
      const ci = cellIdx(k, l, r, bp.coord.col);
      acc.set(ci, (acc.get(ci) ?? 0) + (bp.piece.owner === 'p1' ? 1 : -1));
    }
    const idx: number[] = [];
    const val: number[] = [];
    for (const [i, vv] of acc) if (vv !== 0) { idx.push(i); val.push(vv); }
    rows.push({ idx, val, base, ds: row.ds, shipped });
  }
  setPstTables(null);
  if (clipped > 0) {
    console.log(`  clipped ${clipped.toLocaleString()} near-terminal rows (|ds| > ${clip})`);
  }
  return rows;
}

// Gaussian elimination with partial pivoting (same as texel-tune).
function solveLinear(A: number[][], b: number[]): number[] {
  const m = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < m; c++) {
    let piv = c;
    for (let r = c + 1; r < m; r++)
      if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= m; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[m] / (M[i][i] || 1e-12));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  setEvalParams(null); // ensure shipped DEFAULT_EVAL_PARAMS (pstScale=1)
  console.log(`pst-fit: ${args.data}  (ridge ${args.ridge})`);
  const rows = await extract(args.data, args.limit, args.clip);
  if (rows.length === 0) {
    console.error('No usable positions (need a label-deep\'d file with ds).');
    process.exit(1);
  }
  const n = rows.length;
  console.log(`  ${n.toLocaleString()} positions → fitting ${N_CELL} cells`);

  // Normal equations (XᵀX + λI) θ = Xᵀ t,  t = ds − base. Sparse: only
  // piece-occupied cells contribute, so this is ~O(n · nnz²).
  const A: number[][] = Array.from({ length: N_CELL }, () =>
    new Array<number>(N_CELL).fill(0),
  );
  const bvec = new Array<number>(N_CELL).fill(0);
  for (const row of rows) {
    const t = row.ds - row.base;
    const { idx, val } = row;
    for (let a = 0; a < idx.length; a++) {
      bvec[idx[a]] += val[a] * t;
      for (let b = 0; b < idx.length; b++)
        A[idx[a]][idx[b]] += val[a] * val[b];
    }
  }
  let diagMean = 0;
  for (let j = 0; j < N_CELL; j++) diagMean += A[j][j];
  diagMean = diagMean / N_CELL || 1;
  for (let j = 0; j < N_CELL; j++) A[j][j] += args.ridge * diagMean;

  const theta = solveLinear(A, bvec);

  // Error vs the teacher: shipped PST baseline vs the fitted prediction.
  let ssShipped = 0, ssFitted = 0, ssTot = 0, sumDs = 0;
  for (const r of rows) sumDs += r.ds;
  const meanDs = sumDs / n;
  for (const r of rows) {
    let pred = r.base;
    for (let a = 0; a < r.idx.length; a++) pred += theta[r.idx[a]] * r.val[a];
    ssShipped += (r.shipped - r.ds) ** 2;
    ssFitted += (pred - r.ds) ** 2;
    ssTot += (r.ds - meanDs) ** 2;
  }
  const rmseShipped = Math.sqrt(ssShipped / n);
  const rmseFitted = Math.sqrt(ssFitted / n);
  const r2 = ssTot > 0 ? 1 - ssFitted / ssTot : 0;
  const degenerate = !(Number.isFinite(r2) && r2 > 0.02 && rmseFitted < rmseShipped);

  console.log('── PST fit vs depth-8 teacher ────────────────────────');
  console.log(`  RMSE  shipped ${rmseShipped.toFixed(1)} → fitted ${rmseFitted.toFixed(1)}`);
  console.log(`  R²    ${r2.toFixed(4)}`);
  if (degenerate) {
    console.log('');
    console.log('  ⚠️  WEAK FIT — fitted PST does not clearly beat the shipped');
    console.log('     PST against the teacher. NOT usable; ship nothing.');
  }
  console.log('');
  console.log('  NOTE: better teacher fit ≠ stronger play. Adopt ONLY on a');
  console.log('  clean significant d6 win (a d3 win is NOT sufficient — the');
  console.log('  sign-flip finding was d3-only):');
  console.log(`    npm run selfplay -- --games 1000 --bal --depth-a 6 \\`);
  console.log(`      --depth-b 6 --pst-a ${args.out} --sprt --elo0 0 --elo1 10`);

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(
    args.out,
    JSON.stringify(
      {
        _meta: {
          generated: new Date().toISOString(),
          dataset: args.data,
          ridge: args.ridge,
          positions: n,
          rmseShipped,
          rmseFitted,
          r2,
          degenerate,
        },
        tables: tablesFromTheta(theta),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\nWrote ${args.out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
