/**
 * label-deep — attach a deep-search "teacher" score to each recorded
 * position.
 *
 * Why: the Texel cycle on self-play *game outcomes* failed (near-noise
 * logloss; d3 gain didn't transfer to d6). The diagnosis was the LABEL,
 * not the method — a single position's eventual win/loss at shallow
 * self-play depth barely correlates with its true value. This script
 * relabels each position with the score of a genuine deep search from
 * that position (P1 perspective, eval units), which is a far stronger
 * regression target. `texel-tune --target deep` then fits the cheap
 * eval to imitate the deep search.
 *
 * Usage:
 *   npm run label-deep -- --in data/raw.jsonl --out data/deep.jsonl \
 *     --depth 8 [--time 1500] [--limit 5000] [--every 100]
 *
 * Stance is forced balanced so labels are deterministic (no stance RNG)
 * and consistent with --bal datasets.
 */
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { searchScore, setSearchOptions } from '../src/game/ai';
import type { GameState } from '../src/game/types';

type Args = {
  in?: string;
  out?: string;
  depth: number;
  time?: number;
  limit?: number;
  every: number;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { depth: 8, every: 100 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    switch (argv[i]) {
      case '--in':    a.in = v; i++; break;
      case '--out':   a.out = v; i++; break;
      case '--depth': a.depth = parseInt(v, 10); i++; break;
      case '--time':  a.time = parseInt(v, 10); i++; break;
      case '--limit': a.limit = parseInt(v, 10); i++; break;
      case '--every': a.every = Math.max(1, parseInt(v, 10)); i++; break;
      case '--help':
      case '-h':
        console.log(
          'label-deep --in FILE --out FILE [--depth N] [--time MS] ' +
            '[--limit N] [--every N]',
        );
        process.exit(0);
    }
  }
  if (!a.in) { console.error('--in <jsonl> is required'); process.exit(1); }
  if (!a.out) { console.error('--out <jsonl> is required'); process.exit(1); }
  if (!Number.isFinite(a.depth) || a.depth < 1) {
    console.error('--depth must be a positive integer'); process.exit(1);
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Deterministic teacher: no stance RNG. Everything else stays at the
  // shipped defaults so the deep target reflects the real engine.
  setSearchOptions({ forceBalancedStance: true });

  mkdirSync(dirname(args.out!), { recursive: true });
  const outStream = createWriteStream(args.out!);
  const rl = createInterface({
    input: createReadStream(args.in!),
    crlfDelay: Infinity,
  });

  let labelled = 0;
  let scanned = 0;
  const t0 = Date.now();

  for await (const line of rl) {
    if (line.length === 0) continue;

    if (line.startsWith('{"_meta"')) {
      // Pass the meta through, stamping labeling provenance so the
      // tuner / future readers know these carry deep targets.
      try {
        const obj = JSON.parse(line);
        obj._meta = {
          ...obj._meta,
          deepLabel: { depth: args.depth, time: args.time ?? null },
        };
        outStream.write(JSON.stringify(obj) + '\n');
      } catch {
        outStream.write(line + '\n');
      }
      continue;
    }

    let row: { state: GameState } & Record<string, unknown>;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (!row.state) continue;

    if (args.limit !== undefined && labelled >= args.limit) break;

    const ds = searchScore(row.state, args.depth, args.time);
    row.ds = ds;
    outStream.write(JSON.stringify(row) + '\n');
    labelled++;
    scanned++;

    if (labelled % args.every === 0) {
      const secs = (Date.now() - t0) / 1000;
      const rate = labelled / secs;
      const eta =
        args.limit !== undefined
          ? `, ETA ${Math.round((args.limit - labelled) / rate)}s`
          : '';
      process.stdout.write(
        `  labelled ${labelled} (${rate.toFixed(1)}/s)${eta}\n`,
      );
    }
  }

  await new Promise<void>((res) => outStream.end(res));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\n${labelled} positions deep-labelled (d${args.depth}) → ${args.out} ` +
      `in ${secs}s`,
  );
  if (scanned === 0) {
    console.error('WARNING: no positions labelled — check --in format.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
