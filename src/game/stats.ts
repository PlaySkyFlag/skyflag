// Personal game stats — tracked locally in localStorage. Each completed
// game appends one row, and aggregates (W/L/D, streak) are recomputed
// on read so the data model is just an append-only log.
//
// Only games with a clear "your side" are tracked: 1P (vs AI) and online
// multiplayer. 2P hot-seat is excluded since both sides are "you".

const STORAGE_KEY = '3phor.stats.v1';

export type StatsMode = '1p-ravens' | '1p-stags' | 'online-ravens' | 'online-stags';

export type GameRecord = {
  // ISO timestamp when the game ended.
  when: string;
  mode: StatsMode;
  result: 'win' | 'loss' | 'draw';
  reason: 'nexus' | 'elimination' | 'resignation' | 'time-out' | 'turn-limit' | 'stalemate' | 'agreement';
  turns: number;
};

type StatsFile = {
  history: GameRecord[];
};

function load(): StatsFile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { history: [] };
    const parsed = JSON.parse(raw) as Partial<StatsFile> | null;
    if (!parsed || !Array.isArray(parsed.history)) return { history: [] };
    return { history: parsed.history };
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

export function recordGame(rec: GameRecord): void {
  const file = load();
  file.history.push(rec);
  // Keep the last 500 games to bound the file size; older results still
  // count in lifetime aggregates if we ever migrate to server-side stats.
  if (file.history.length > 500) {
    file.history = file.history.slice(-500);
  }
  save(file);
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

const MODE_LABELS: Record<StatsMode, string> = {
  '1p-ravens': '1P · Ravens',
  '1p-stags': '1P · Stags',
  'online-ravens': 'Online · Ravens',
  'online-stags': 'Online · Stags',
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

export function clearStats(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
