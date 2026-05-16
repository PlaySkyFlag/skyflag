/*
 * Parallel self-play generator.
 *
 * `scripts/selfplay.ts` is single-process. To use every core, this
 * spawns N worker processes — each running the normal selfplay with a
 * distinct --seed and its own --record shard file — then concatenates
 * the shards into one JSONL training set.
 *
 * Run:
 *   npm run selfplay:shards -- --games 40000 --out data/selfplay.jsonl
 *   npm run selfplay:shards -- --games 40000 --shards 10 --bal --depth-a 3 --depth-b 3 --record-stride 6
 *   npm run selfplay:shards -- --games 8 --shards 4 --gzip --keep-shards
 *
 * Own flags (consumed here):
 *   --games N        total games across all shards (default 1000)
 *   --shards N        worker processes (default = CPU count)
 *   --out FILE        combined JSONL (default data/selfplay.jsonl)
 *   --seed N          base seed; shard k uses seed (N + k) (default 1)
 *   --keep-shards     keep the per-shard files after concat
 *   --gzip            also write <out>.gz (streamed)
 *
 * Every other arg is forwarded verbatim to each selfplay worker, so
 * --bal, --depth-a/b, --time-a/b, --record-stride, --record-min-turn,
 * the --no-* toggles, etc. all work unchanged.
 *
 * Seed safety: selfplay derives per-game seeds as seed*1_000_000 + i,
 * so distinct integer shard seeds give disjoint ranges as long as
 * games-per-shard < 1_000_000 (enforced below).
 */

import { spawn } from 'node:child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

// ─── Args ──────────────────────────────────────────────────────────────────

type ShardArgs = {
  games: number;
  shards: number;
  out: string;
  seed: number;
  keepShards: boolean;
  gzip: boolean;
  passthrough: string[];
};

function parseArgs(argv: string[]): ShardArgs {
  const a: ShardArgs = {
    games: 1000,
    shards: cpus().length,
    out: 'data/selfplay.jsonl',
    seed: 1,
    keepShards: false,
    gzip: false,
    passthrough: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--games':       a.games = parseInt(v, 10); i++; break;
      case '--shards':      a.shards = Math.max(1, parseInt(v, 10)); i++; break;
      case '--out':         a.out = v; i++; break;
      case '--seed':        a.seed = parseInt(v, 10); i++; break;
      case '--keep-shards': a.keepShards = true; break;
      case '--gzip':        a.gzip = true; break;
      // selfplay owns --record / --quiet / --games / --seed; the shard
      // runner sets those per worker, so drop them if passed here.
      case '--record':      i++; break;
      case '--quiet':       break;
      case '--help':
      case '-h':
        console.log(
          'selfplay:shards --games N [--shards N] [--out FILE] [--seed N]\n' +
          '                [--keep-shards] [--gzip] [...selfplay flags]',
        );
        process.exit(0);
        break;
      default:
        a.passthrough.push(k);
    }
  }
  return a;
}

// ─── One worker ────────────────────────────────────────────────────────────

function runShard(
  bin: string,
  binArgs: string[],
  shardArgs: string[],
  index: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [...binArgs, ...shardArgs], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`shard ${index} exited ${code}\n${err.trim()}`));
    });
  });
}

// ─── Concatenate shards → one JSONL (drop per-shard _meta lines) ────────────

async function concat(
  shardFiles: string[],
  out: string,
  meta: object,
  gzip: boolean,
): Promise<{ positions: number; bytes: number }> {
  const raw = createWriteStream(out);
  raw.write(JSON.stringify(meta) + '\n');
  let positions = 0;
  for (const f of shardFiles) {
    const rl = createInterface({
      input: createReadStream(f),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (line.length === 0 || line.startsWith('{"_meta"')) continue;
      raw.write(line + '\n');
      positions++;
    }
  }
  await new Promise<void>((res) => raw.end(res));
  const bytes = statSync(out).size;
  if (gzip) {
    await pipeline(
      createReadStream(out),
      createGzip(),
      createWriteStream(out + '.gz'),
    );
  }
  return { positions, bytes };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2));

  const perShard = Math.ceil(a.games / a.shards);
  if (perShard >= 1_000_000) {
    console.error(
      `games-per-shard (${perShard}) must be < 1,000,000 — raise --shards ` +
      `or lower --games (per-game seed ranges would otherwise collide).`,
    );
    process.exit(1);
  }

  // Local tsx if present (fast), else npx tsx (portable).
  const localTsx = join('node_modules', '.bin', 'tsx');
  const useLocal = existsSync(localTsx);
  const bin = useLocal ? localTsx : 'npx';
  const binArgs = (useLocal ? [] : ['tsx']).concat(['scripts/selfplay.ts']);

  const shardDir = a.out + '.shards';
  mkdirSync(dirname(a.out), { recursive: true });
  if (existsSync(shardDir)) rmSync(shardDir, { recursive: true, force: true });
  mkdirSync(shardDir, { recursive: true });

  const plan: { games: number; seed: number; file: string }[] = [];
  let remaining = a.games;
  for (let k = 0; k < a.shards && remaining > 0; k++) {
    const games = Math.min(perShard, remaining);
    remaining -= games;
    plan.push({ games, seed: a.seed + k, file: join(shardDir, `shard-${k}.jsonl`) });
  }

  console.log(
    `Generating ${a.games} games across ${plan.length} shards ` +
    `(${perShard}/shard), seeds ${a.seed}..${a.seed + plan.length - 1}\n` +
    `forwarding: ${a.passthrough.join(' ') || '(none)'}`,
  );
  const t0 = Date.now();

  const results = await Promise.allSettled(
    plan.map((p, k) =>
      runShard(
        bin,
        binArgs,
        [
          '--games', String(p.games),
          '--seed', String(p.seed),
          '--record', p.file,
          '--quiet',
          ...a.passthrough,
        ],
        k,
      ).then(() => {
        process.stdout.write(`  shard ${k} done\n`);
      }),
    ),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    for (const f of failed) console.error((f as PromiseRejectedResult).reason.message ?? f);
    console.error(`\n${failed.length}/${plan.length} shards failed — aborting concat.`);
    process.exit(1);
  }

  const present = plan
    .map((p) => p.file)
    .filter((f) => existsSync(f) && statSync(f).size > 0);
  const { positions, bytes } = await concat(
    present,
    a.out,
    {
      _meta: {
        created: new Date().toISOString(),
        note: 'skyflag self-play Texel dataset (sharded)',
        fields: ['r', 'reason', 'stm', 'ply', 'state'],
        shards: plan.length,
        games: a.games,
        seedBase: a.seed,
        selfplayArgs: a.passthrough,
      },
    },
    a.gzip,
  );

  if (!a.keepShards) rmSync(shardDir, { recursive: true, force: true });

  const secs = (Date.now() - t0) / 1000;
  const gb = bytes / 1e9;
  console.log(
    `\n${positions.toLocaleString()} positions → ${a.out}` +
    (a.gzip ? ` (+ ${a.out}.gz)` : '') +
    `\n${a.games} games in ${secs.toFixed(1)}s ` +
    `(${(a.games / secs).toFixed(1)} games/s, ` +
    `${Math.round(positions / secs).toLocaleString()} positions/s)` +
    `\nsize: ${gb < 1 ? `${(bytes / 1e6).toFixed(0)} MB` : `${gb.toFixed(1)} GB`}` +
    ` raw${a.gzip ? `, ${(statSync(a.out + '.gz').size / 1e6).toFixed(0)} MB gz` : ''}`,
  );
  // Touch readdir so an empty shardDir (kept) doesn't look orphaned.
  if (a.keepShards) console.log(`shards kept: ${readdirSync(shardDir).length} files in ${shardDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
