import { useEffect, useState } from 'react';
import { clearStats, modeLabel, summarize, type StatsSummary } from './game/stats';

type Props = {
  open: boolean;
  onClose: () => void;
};

const REASON_GLYPH: Record<'nexus' | 'elimination' | 'turn-limit' | 'stalemate', string> = {
  nexus: '◎',
  elimination: '×',
  'turn-limit': '⏱',
  stalemate: '∅',
};

export default function StatsModal({ open, onClose }: Props) {
  const [stats, setStats] = useState<StatsSummary | null>(null);

  useEffect(() => {
    if (open) setStats(summarize());
  }, [open]);

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
                onClick={() => {
                  if (confirm('Clear all locally-stored game stats? This cannot be undone.')) {
                    clearStats();
                    setStats(summarize());
                  }
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
