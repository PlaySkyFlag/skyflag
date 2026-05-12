import { useEffect, useState } from 'react';
import {
  clearStats,
  clearStatsEverywhere,
  modeLabel,
  summarize,
  syncStatsForUser,
  type StatsSummary,
} from './game/stats';

type Props = {
  open: boolean;
  onClose: () => void;
  // Logged-in user id (or null for guests). When present, "Clear stats"
  // wipes the server rows in addition to localStorage, and opening the
  // modal triggers a fresh server hydrate so the summary reflects any
  // games played on other devices.
  userId: string | null;
};

const REASON_GLYPH: Record<
  'nexus' | 'elimination' | 'resignation' | 'time-out' | 'turn-limit' | 'stalemate' | 'agreement',
  string
> = {
  nexus: '◎',
  elimination: '×',
  resignation: '⚐',
  'time-out': '⏱',
  'turn-limit': '⌛',
  stalemate: '∅',
  agreement: '🤝',
};

export default function StatsModal({ open, onClose, userId }: Props) {
  const [stats, setStats] = useState<StatsSummary | null>(null);

  useEffect(() => {
    if (!open) return;
    // Show whatever's in the local cache immediately so the modal
    // doesn't flash empty while the server round-trip runs.
    setStats(summarize());
    // Then, if signed in, refresh from the server in case games were
    // played on another device since this device last synced. The
    // refresh re-runs summarize once it lands.
    if (userId) {
      void syncStatsForUser(userId).then(() => setStats(summarize()));
    }
  }, [open, userId]);

  if (!open || !stats) return null;

  const streakLabel =
    stats.currentStreak > 0
      ? `${stats.currentStreak}W`
      : stats.currentStreak < 0
        ? `${Math.abs(stats.currentStreak)}L`
        : '—';

  return (
    <div className="account-overlay" role="dialog" aria-modal="true">
      <div className="account-card stats-card">
        <div className="account-header">
          <h2 className="account-title">Game stats</h2>
          <button type="button" className="account-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {stats.totalGames === 0 ? (
          <p className="account-intro">No games recorded yet — finish one to see stats here.</p>
        ) : (
          <>
            <p className="stats-disclaimer">
              2-player hot-seat games aren't counted here (both sides
              are you), so this total may lag your actual play.
            </p>
            <div className="stats-grid">
              <div className="stats-cell">
                <div className="stats-num">{stats.totalGames}</div>
                <div className="stats-label">Games</div>
              </div>
              <div className="stats-cell">
                <div className="stats-num">{stats.winPct}%</div>
                <div className="stats-label">Win rate</div>
              </div>
              <div className="stats-cell">
                <div className="stats-num">
                  <span className="stats-w">{stats.wins}</span>
                  <span className="stats-sep">/</span>
                  <span className="stats-l">{stats.losses}</span>
                  <span className="stats-sep">/</span>
                  <span className="stats-d">{stats.draws}</span>
                </div>
                <div className="stats-label">W / L / D</div>
              </div>
              <div className="stats-cell">
                <div className="stats-num">{streakLabel}</div>
                <div className="stats-label">Streak</div>
              </div>
              <div className="stats-cell">
                <div className="stats-num">{stats.bestWinStreak}</div>
                <div className="stats-label">Best win streak</div>
              </div>
              <div className="stats-cell">
                <div className="stats-num">{stats.avgTurns}</div>
                <div className="stats-label">Avg turns</div>
              </div>
            </div>

            <h3 className="stats-subtitle">By mode</h3>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Games</th>
                  <th>W</th>
                  <th>L</th>
                  <th>D</th>
                </tr>
              </thead>
              <tbody>
                {(Object.entries(stats.byMode) as Array<[keyof typeof stats.byMode, typeof stats.byMode[keyof typeof stats.byMode]]>).map(
                  ([mode, m]) => (
                    <tr key={mode}>
                      <td>{modeLabel(mode)}</td>
                      <td>{m.games}</td>
                      <td>{m.wins}</td>
                      <td>{m.losses}</td>
                      <td>{m.draws}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>

            <h3 className="stats-subtitle">Recent games</h3>
            <ul className="stats-recent">
              {stats.recent.map((r, i) => (
                <li key={i} className={`stats-recent-row stats-result-${r.result}`}>
                  <span className="stats-recent-result">
                    {r.result === 'win' ? 'W' : r.result === 'loss' ? 'L' : 'D'}
                  </span>
                  <span className="stats-recent-mode">{modeLabel(r.mode)}</span>
                  <span className="stats-recent-meta">
                    T{r.turns} · {REASON_GLYPH[r.reason]}
                  </span>
                  <span className="stats-recent-when">
                    {new Date(r.when).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </li>
              ))}
            </ul>

            <div className="account-actions">
              <button
                type="button"
                className="end-game-btn end-game-btn--subtle"
                onClick={async () => {
                  const msg = userId
                    ? 'Clear all your game stats on every device? This cannot be undone.'
                    : 'Clear all locally-stored game stats? This cannot be undone.';
                  if (!confirm(msg)) return;
                  if (userId) {
                    await clearStatsEverywhere(userId);
                  } else {
                    clearStats();
                  }
                  setStats(summarize());
                }}
              >
                Clear stats
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
