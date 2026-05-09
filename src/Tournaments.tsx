// Tournaments panel — lists open arenas, lets the signed-in user join,
// shows a live leaderboard. Entries auto-update when the apply-rating
// Edge Function fires after each finished MP game (we re-poll the
// active tournament's entries on focus / mount).

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './game/supabase';
import type { Profile } from './game/profile';

type Tournament = {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  is_paid: boolean;
  entry_fee_cents: number;
};

type TournamentEntry = {
  tournament_id: string;
  user_id: string;
  joined_at: string;
  wins: number;
  losses: number;
  draws: number;
  score: number;
};

type LeaderboardRow = TournamentEntry & {
  nickname: string;
  rating: number;
};

type Props = {
  user: User | null;
  profile: Profile | null;
};

export default function Tournaments({ user, profile }: Props) {
  const [open, setOpen] = useState<Tournament[]>([]);
  const [myEntries, setMyEntries] = useState<Set<string>>(new Set());
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardRow[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const sb = supabase;
    const nowIso = new Date().toISOString();
    const { data: tlist } = await sb
      .from('tournaments')
      .select('*')
      .lte('starts_at', nowIso)
      .gte('ends_at', nowIso)
      .order('ends_at', { ascending: true });
    const tournaments = (tlist ?? []) as Tournament[];
    setOpen(tournaments);

    if (user) {
      const { data: mine } = await sb
        .from('tournament_entries')
        .select('tournament_id')
        .eq('user_id', user.id);
      setMyEntries(new Set((mine ?? []).map((m) => m.tournament_id as string)));
    } else {
      setMyEntries(new Set());
    }

    // Pull leaderboards for the expanded tournament (or the first one
    // by default, so we always show something).
    const targetId = expandedId ?? tournaments[0]?.id;
    if (targetId) {
      const { data: rows } = await sb
        .from('tournament_entries')
        .select('tournament_id, user_id, joined_at, wins, losses, draws, score')
        .eq('tournament_id', targetId)
        .order('score', { ascending: false })
        .order('wins', { ascending: false })
        .limit(20);
      const entries = (rows ?? []) as TournamentEntry[];
      const ids = entries.map((e) => e.user_id);
      let profMap = new Map<string, { nickname: string; rating: number }>();
      if (ids.length > 0) {
        const { data: profs } = await sb
          .from('profiles')
          .select('id, nickname, rating')
          .in('id', ids);
        profMap = new Map(
          (profs ?? []).map((p) => [
            p.id as string,
            { nickname: p.nickname as string, rating: p.rating as number },
          ]),
        );
      }
      const board: LeaderboardRow[] = entries.map((e) => {
        const meta = profMap.get(e.user_id);
        return {
          ...e,
          nickname: meta?.nickname ?? '—',
          rating: meta?.rating ?? 1200,
        };
      });
      setLeaderboards((prev) => ({ ...prev, [targetId]: board }));
    }
  }, [user, expandedId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const join = useCallback(
    async (tid: string) => {
      if (!supabase || !user || !profile) return;
      setBusy(true);
      setError(null);
      const { error: insertErr } = await supabase
        .from('tournament_entries')
        .insert({ tournament_id: tid, user_id: user.id });
      setBusy(false);
      if (insertErr && !/duplicate/.test(insertErr.message)) {
        setError(`Couldn't join: ${insertErr.message}`);
        return;
      }
      setExpandedId(tid);
      refresh();
    },
    [user, profile, refresh],
  );

  if (!supabase) return null;

  return (
    <details className="help">
      <summary className="help-summary">Tournaments</summary>
      <div className="help-body">
        {open.length === 0 && (
          <p className="lobby-hint">
            No open arenas right now — check back later, or stay tuned for
            announcements.
          </p>
        )}
        {open.map((t) => {
          const joined = myEntries.has(t.id);
          const board = leaderboards[t.id] ?? [];
          const expanded = expandedId === t.id || (expandedId === null && t === open[0]);
          const endsIn = formatRemaining(t.ends_at);
          return (
            <div key={t.id} className="tournament">
              <div className="tournament-header">
                <div>
                  <div className="tournament-name">
                    {t.name}{' '}
                    {t.is_paid && t.entry_fee_cents > 0 ? (
                      <span className="tournament-fee">${(t.entry_fee_cents / 100).toFixed(2)}</span>
                    ) : (
                      <span className="tournament-free">Free</span>
                    )}
                  </div>
                  <div className="tournament-meta">Ends in {endsIn} · {board.length} entrants</div>
                </div>
                <div className="tournament-actions">
                  {user && profile ? (
                    joined ? (
                      <span className="tournament-joined">✓ Joined</span>
                    ) : (
                      <button
                        type="button"
                        className="hud-btn"
                        disabled={busy}
                        onClick={() => join(t.id)}
                      >
                        {busy ? 'Joining…' : 'Join'}
                      </button>
                    )
                  ) : (
                    <span className="tournament-meta">Sign in to join</span>
                  )}
                  <button
                    type="button"
                    className="hud-btn hud-btn-subtle"
                    onClick={() => setExpandedId(expanded ? null : t.id)}
                  >
                    {expanded ? 'Hide board' : 'Leaderboard'}
                  </button>
                </div>
              </div>
              {t.description && <p className="tournament-desc">{t.description}</p>}
              {expanded && (
                <div className="tournament-board">
                  {board.length === 0 ? (
                    <p className="lobby-hint">
                      No games scored yet. Join, head to the lobby, and play someone.
                    </p>
                  ) : (
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Player</th>
                          <th>Rating</th>
                          <th>W</th>
                          <th>D</th>
                          <th>L</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {board.map((row, i) => (
                          <tr key={row.user_id} className={user && row.user_id === user.id ? 'tournament-self' : undefined}>
                            <td>{i + 1}</td>
                            <td>{row.nickname}</td>
                            <td>{row.rating}</td>
                            <td>{row.wins}</td>
                            <td>{row.draws}</td>
                            <td>{row.losses}</td>
                            <td><strong>{row.score}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {error && <p className="mp-error">⚠ {error}</p>}
      </div>
    </details>
  );
}

function formatRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
