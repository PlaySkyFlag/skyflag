// Personal game stats. Source of truth is the server (table
// `personal_games`, migration 024) when the user is signed in; localStorage
// is an offline cache so stats appear instantly on app boot and during
// network blips. Each completed game appends one row, and aggregates
// (W/L/D, streak) are recomputed on read so the data model stays an
// append-only log.
//
// Sync flow:
//   - On every game-end: write to localStorage (sync, immediate UI
//     reflect) AND fire-and-forget write to server.
//   - On sign-in / app boot with a signed-in user: backfill any local
//     rows the server hasn't seen (INSERT ON CONFLICT DO NOTHING via the
//     `unique (user_id, client_id)` constraint), then hydrate the local
//     cache from the server so it reflects ALL devices the user signs in
//     on.
//   - When signed out: localStorage-only. On next sign-in, the backfill
//     promotes guest games to the user's server history.
//
// Anonymous Supabase users (`signInAnonymously`) have a real `auth.uid()`
// and pass RLS, so even guest games go server-side. When they later
// link an email, Supabase preserves the same auth.uid() — server stats
// follow them.
//
// Only games with a clear "your side" are tracked: 1P (vs AI) and online
// multiplayer. 2P hot-seat is excluded since both sides are "you".

import { supabase } from './supabase';

const STORAGE_KEY = '3phor.stats.v1';

export type StatsMode = '1p-ravens' | '1p-stags' | 'online-ravens' | 'online-stags';

export type GameRecord = {
  // ISO timestamp when the game ended.
  when: string;
  mode: StatsMode;
  result: 'win' | 'loss' | 'draw';
  reason: 'nexus' | 'elimination' | 'resignation' | 'time-out' | 'turn-limit' | 'stalemate' | 'agreement';
  turns: number;
  // Stable per-record UUID. Doubles as idempotency key on server insert
  // and as the dedup key when backfilling localStorage rows to a fresh
  // server account. Optional in the type because legacy localStorage
  // rows predating this field exist; loaders fill it in lazily.
  clientId?: string;
};

type StatsFile = {
  history: GameRecord[];
};

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Defensive fallback for headless test environments without crypto.
  // 32 hex chars formatted as a v4-ish UUID. Not used in any browser
  // Skyflag targets in practice.
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function load(): StatsFile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { history: [] };
    const parsed = JSON.parse(raw) as Partial<StatsFile> | null;
    if (!parsed || !Array.isArray(parsed.history)) return { history: [] };
    // Lazy migration: legacy rows lacked clientId. Mint one per row the
    // first time we read them, and persist back so subsequent reads (and
    // server backfills) see stable ids. Without this, every backfill
    // pass would mint new ids and re-insert duplicates.
    let migrated = false;
    const history = parsed.history.map((r) => {
      if (!r.clientId) {
        migrated = true;
        return { ...r, clientId: newClientId() };
      }
      return r;
    });
    if (migrated) save({ history });
    return { history };
  } catch {
    return { history: [] };
  }
}

function save(file: StatsFile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch {
    // Quota / private mode — accept the loss silently.
  }
}

// Total games played to date. Cheap O(1) read used by the guest-upgrade
// banner heuristic so we only nudge users who've actually invested time.
export function totalGameCount(): number {
  return load().history.length;
}

// Append a finished game to the local cache. Synchronous so the stats
// modal reflects it immediately. Call `syncGameToServer` separately to
// persist beyond this device.
export function recordGame(rec: GameRecord): GameRecord {
  const withId: GameRecord = { ...rec, clientId: rec.clientId ?? newClientId() };
  const file = load();
  file.history.push(withId);
  // Keep the last 500 games in the local cache to bound storage. Server
  // history is unbounded — older games still appear in lifetime
  // aggregates once we hydrate from the server.
  if (file.history.length > 500) {
    file.history = file.history.slice(-500);
  }
  save(file);
  return withId;
}

// Fire-and-forget server write. Safe to call without awaiting; on
// failure the row stays in localStorage and the next backfill picks it
// up. Returns whether the write succeeded — callers can ignore it.
export async function syncGameToServer(rec: GameRecord, userId: string): Promise<boolean> {
  if (!supabase) return false;
  if (!rec.clientId) return false;
  const { error } = await supabase.from('personal_games').insert({
    user_id: userId,
    client_id: rec.clientId,
    mode: rec.mode,
    result: rec.result,
    reason: rec.reason,
    turns: rec.turns,
    played_at: rec.when,
  });
  // Conflict on (user_id, client_id) means we already synced this row —
  // not a real failure. Postgres error code 23505 = unique_violation.
  if (error && !/duplicate key|23505/i.test(error.message)) {
    return false;
  }
  return true;
}

// Pushes every local game that isn't already on the server. Idempotent
// via the unique (user_id, client_id) constraint. Used on sign-in and
// on first app-load with an existing session.
export async function backfillToServer(userId: string): Promise<void> {
  if (!supabase) return;
  const { history } = load();
  if (history.length === 0) return;
  const rows = history
    .filter((r) => !!r.clientId)
    .map((r) => ({
      user_id: userId,
      client_id: r.clientId,
      mode: r.mode,
      result: r.result,
      reason: r.reason,
      turns: r.turns,
      played_at: r.when,
    }));
  if (rows.length === 0) return;
  // ON CONFLICT DO NOTHING — supabase-js exposes this via upsert with
  // ignoreDuplicates. Server-side this becomes INSERT ... ON CONFLICT
  // (user_id, client_id) DO NOTHING.
  await supabase
    .from('personal_games')
    .upsert(rows, { onConflict: 'user_id,client_id', ignoreDuplicates: true });
}

// Replace local cache with the server's view of this user's history.
// Run after `backfillToServer` so any local-only rows are preserved.
// On network failure, keep whatever's in localStorage — no destructive
// wipe on a transient error.
export async function hydrateFromServer(userId: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('personal_games')
    .select('client_id, mode, result, reason, turns, played_at')
    .eq('user_id', userId)
    .order('played_at', { ascending: true });
  if (error || !data) return;
  const history: GameRecord[] = data.map((row) => ({
    when: row.played_at as string,
    mode: row.mode as StatsMode,
    result: row.result as GameRecord['result'],
    reason: row.reason as GameRecord['reason'],
    turns: row.turns as number,
    clientId: row.client_id as string,
  }));
  // Cap at 500 in the local cache; server still has the full set.
  const capped = history.length > 500 ? history.slice(-500) : history;
  save({ history: capped });
}

// One-shot helper: backfill then hydrate. Call on sign-in or on app
// boot if a session is already present. Safe to invoke repeatedly —
// backfill is idempotent and hydrate is read-only against the server.
export async function syncStatsForUser(userId: string): Promise<void> {
  if (!supabase) return;
  try {
    await backfillToServer(userId);
    await hydrateFromServer(userId);
  } catch {
    // Network / permission errors are non-fatal — the local cache is
    // still authoritative for what this device shows.
  }
}

export type StatsSummary = {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winPct: number;
  currentStreak: number; // positive = win streak, negative = loss streak, 0 = none/draw
  bestWinStreak: number;
  avgTurns: number;
  byMode: Record<StatsMode, { games: number; wins: number; losses: number; draws: number }>;
  recent: GameRecord[];
};

// Key strings are kept stable (they map 1:1 to an engine slot and are
// persisted/synced); only the human-readable labels follow the faction
// remap. '*-ravens' = the p1 slot = White Stags; '*-stags' = p2 = Grey
// Ravens. Renaming keys would orphan existing stats history.
const MODE_LABELS: Record<StatsMode, string> = {
  '1p-ravens': '1P · White Stags',
  '1p-stags': '1P · Grey Ravens',
  'online-ravens': 'Online · White Stags',
  'online-stags': 'Online · Grey Ravens',
};

export function modeLabel(m: StatsMode): string {
  return MODE_LABELS[m];
}

export function summarize(): StatsSummary {
  const { history } = load();
  const byMode: StatsSummary['byMode'] = {
    '1p-ravens': { games: 0, wins: 0, losses: 0, draws: 0 },
    '1p-stags':  { games: 0, wins: 0, losses: 0, draws: 0 },
    'online-ravens': { games: 0, wins: 0, losses: 0, draws: 0 },
    'online-stags':  { games: 0, wins: 0, losses: 0, draws: 0 },
  };
  let wins = 0, losses = 0, draws = 0, turns = 0;
  for (const r of history) {
    const slot = byMode[r.mode];
    if (slot) {
      slot.games++;
      if (r.result === 'win') slot.wins++;
      else if (r.result === 'loss') slot.losses++;
      else slot.draws++;
    }
    if (r.result === 'win') wins++;
    else if (r.result === 'loss') losses++;
    else draws++;
    turns += r.turns;
  }

  // Compute streaks by walking history forward. Reset on draws and loss
  // tracks separately for "current".
  let bestWinStreak = 0;
  let runningWin = 0;
  for (const r of history) {
    if (r.result === 'win') {
      runningWin++;
      if (runningWin > bestWinStreak) bestWinStreak = runningWin;
    } else {
      runningWin = 0;
    }
  }

  // Current streak: walk backwards from the most recent game until the
  // result changes or we hit a draw (draws break streaks).
  let currentStreak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i];
    if (r.result === 'draw') break;
    const sign = r.result === 'win' ? 1 : -1;
    if (currentStreak === 0 || Math.sign(currentStreak) === sign) {
      currentStreak += sign;
    } else {
      break;
    }
  }

  const totalGames = history.length;
  return {
    totalGames,
    wins,
    losses,
    draws,
    winPct: totalGames === 0 ? 0 : Math.round((wins / totalGames) * 100),
    currentStreak,
    bestWinStreak,
    avgTurns: totalGames === 0 ? 0 : Math.round((turns / totalGames) * 10) / 10,
    byMode,
    recent: history.slice(-10).reverse(),
  };
}

// Clears the local cache only. Use `clearStatsEverywhere(userId)` to
// also wipe the server rows for the signed-in user.
export function clearStats(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// Wipes local cache AND server rows for the given user. Used by the
// "Clear stats" button in the stats modal — destructive but explicit.
export async function clearStatsEverywhere(userId: string): Promise<void> {
  clearStats();
  if (!supabase) return;
  await supabase.from('personal_games').delete().eq('user_id', userId);
}
