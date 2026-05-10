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
  created_by: string | null;
  cancelled_at: string | null;
};

// User-selectable duration options in days. Constrained at the DB level
// to between 1 and 30 days; these are sensible presets.
const DURATION_OPTIONS = [
  { days: 1,  label: '1 day' },
  { days: 3,  label: '3 days' },
  { days: 7,  label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

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
  inline?: boolean;
  // Opens the AccountModal so unverified guests can link an email
  // when they want to join a tournament. Passed through from App via
  // Sidebar.
  onOpenAccount?: () => void;
};

export default function Tournaments({ user, profile, inline = false, onOpenAccount }: Props) {
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
    // Show anything still alive: not cancelled, not yet ended. This
    // surfaces upcoming tournaments too so players can pre-register
    // and the creator sees their own scheduled events.
    const { data: tlist } = await sb
      .from('tournaments')
      .select('*')
      .gte('ends_at', nowIso)
      .is('cancelled_at', null)
      .order('starts_at', { ascending: true });
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

  // Create-tournament form state. `showCreate` toggles the form open;
  // the rest are the bound inputs.
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDays, setNewDays] = useState<number>(7);

  const createTournament = useCallback(async () => {
    if (!supabase || !user) return;
    const trimmedName = newName.trim();
    if (trimmedName.length < 3) {
      setError('Tournament name must be at least 3 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + newDays * 86_400_000);
    const { error: insertErr } = await supabase.from('tournaments').insert({
      name: trimmedName,
      description: newDesc.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      is_paid: false,
      entry_fee_cents: 0,
      created_by: user.id,
    });
    setBusy(false);
    if (insertErr) {
      // RLS rejects the insert when the user already has an active
      // tournament — surface that as a friendly message rather than
      // the raw policy violation.
      const msg = /violates row-level security/i.test(insertErr.message)
        ? "You already have an active tournament. Cancel it before starting another."
        : `Couldn't create: ${insertErr.message}`;
      setError(msg);
      return;
    }
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
    setNewDays(7);
    refresh();
  }, [user, newName, newDesc, newDays, refresh]);

  const cancelTournament = useCallback(
    async (tid: string) => {
      if (!supabase || !user) return;
      if (!confirm('Cancel this tournament? Players will be unable to join or score new games.')) return;
      setBusy(true);
      setError(null);
      const { error: updErr } = await supabase
        .from('tournaments')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', tid);
      setBusy(false);
      if (updErr) {
        setError(`Couldn't cancel: ${updErr.message}`);
        return;
      }
      refresh();
    },
    [user, refresh],
  );

  if (!supabase) return null;

  const body = (
    <div className="help-body">
        {/* Create-tournament affordance — signed-in users only. The
            actual policy is enforced in the DB; the UI just shortcuts
            the obvious "signed out" case so we don't surface a confusing
            RLS error. */}
        {user && profile && (
          <div className="tournament-create-row">
            {!showCreate ? (
              <button
                type="button"
                className="hud-btn"
                onClick={() => {
                  setShowCreate(true);
                  setError(null);
                }}
              >
                + Create tournament
              </button>
            ) : (
              <div className="tournament-create-form">
                <input
                  type="text"
                  className="account-input"
                  placeholder="Tournament name (3–60 characters)"
                  maxLength={60}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <textarea
                  className="account-input"
                  placeholder="Description (optional)"
                  maxLength={500}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                />
                <label className="tournament-create-label">
                  Duration
                  <select
                    className="hud-mode-select"
                    value={newDays}
                    onChange={(e) => setNewDays(Number(e.target.value))}
                  >
                    {DURATION_OPTIONS.map((o) => (
                      <option key={o.days} value={o.days}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <p className="lobby-hint">
                  Free tournament. Starts immediately. Players join via the
                  list below, then score wins by playing each other in the
                  online lobby. 1 active tournament per creator.
                </p>
                <div className="tournament-create-actions">
                  <button
                    type="button"
                    className="hud-btn"
                    disabled={busy}
                    onClick={createTournament}
                  >
                    {busy ? 'Creating…' : 'Create tournament'}
                  </button>
                  <button
                    type="button"
                    className="hud-btn hud-btn-subtle"
                    disabled={busy}
                    onClick={() => {
                      setShowCreate(false);
                      setNewName('');
                      setNewDesc('');
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {open.length === 0 && (
          <p className="lobby-hint">
            No open arenas right now — {user && profile ? 'create one above' : 'sign in to create one'}, or check back later.
          </p>
        )}
        {open.map((t) => {
          const joined = myEntries.has(t.id);
          const board = leaderboards[t.id] ?? [];
          const expanded = expandedId === t.id || (expandedId === null && t === open[0]);
          const now = Date.now();
          const startsTs = new Date(t.starts_at).getTime();
          const upcoming = startsTs > now;
          const timeLabel = upcoming
            ? `Starts in ${formatRemaining(t.starts_at)}`
            : `Ends in ${formatRemaining(t.ends_at)}`;
          const isMine = user !== null && t.created_by === user.id;
          // Verified-email check (migration 015). Guests and email-link
          // users mid-confirmation will have email_confirmed_at = null.
          // The DB will reject the join with an RLS error if we skip
          // this client guard, so we surface the requirement up front
          // with a friendlier CTA.
          const verified = user !== null && user.email_confirmed_at !== null;
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
                    {isMine && <span className="tournament-mine">Yours</span>}
                  </div>
                  <div className="tournament-meta">{timeLabel} · {board.length} entrants</div>
                </div>
                <div className="tournament-actions">
                  {user && profile ? (
                    joined ? (
                      <span className="tournament-joined">✓ Joined</span>
                    ) : upcoming ? (
                      <span className="tournament-meta">Joinable when it starts</span>
                    ) : !verified ? (
                      <button
                        type="button"
                        className="hud-btn hud-btn-subtle"
                        onClick={() => onOpenAccount?.()}
                        title="Tournaments require a verified email — link one to join"
                      >
                        Verify email to join
                      </button>
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
                  {isMine && (
                    <button
                      type="button"
                      className="hud-btn hud-btn-warn"
                      disabled={busy}
                      onClick={() => cancelTournament(t.id)}
                      title="Cancel this tournament"
                    >
                      Cancel
                    </button>
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
  );
  if (inline) return body;
  return (
    <details className="help">
      <summary className="help-summary">Tournaments</summary>
      {body}
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
