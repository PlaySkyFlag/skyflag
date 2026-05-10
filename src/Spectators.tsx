// Spectators panel — lists currently-public games (tournament games
// auto-marked is_public=true by the games_mark_public_trg trigger).
// Click a row → navigate to /watch/<room_code> for the live read-only
// view.

import { useCallback, useEffect, useState } from 'react';
import PlusBadge from './PlusBadge';
import { supabase } from './game/supabase';

type PublicGame = {
  room_code: string;
  p1_id: string | null;
  p2_id: string | null;
  state: { status?: { kind: string }; turnNumber?: number } | null;
  created_at: string;
};

type PlayerMeta = {
  nickname: string;
  rating: number;
  is_plus: boolean;
};

type Props = {
  inline?: boolean;
};

export default function Spectators({ inline = false }: Props) {
  const [games, setGames] = useState<PublicGame[]>([]);
  const [profiles, setProfiles] = useState<Map<string, PlayerMeta>>(new Map());

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const sb = supabase;
    const { data: rows } = await sb
      .from('games')
      .select('room_code, p1_id, p2_id, state, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(40);
    const list = (rows ?? []) as PublicGame[];

    // Filter to games still in progress — finished games can stay in
    // the DB but shouldn't clutter the watch list.
    const live = list.filter((g) => {
      const status = g.state?.status?.kind;
      return status === 'in-progress' || status === undefined;
    });
    setGames(live);

    // One profile-lookup pass for all distinct player IDs.
    const ids = new Set<string>();
    for (const g of live) {
      if (g.p1_id) ids.add(g.p1_id);
      if (g.p2_id) ids.add(g.p2_id);
    }
    if (ids.size > 0) {
      const { data: profs } = await sb
        .from('profiles')
        .select('id, nickname, rating, is_plus')
        .in('id', Array.from(ids));
      const map = new Map<string, PlayerMeta>();
      for (const p of (profs ?? []) as {
        id: string;
        nickname: string;
        rating: number;
        is_plus: boolean | null;
      }[]) {
        map.set(p.id, {
          nickname: p.nickname,
          rating: p.rating,
          is_plus: p.is_plus ?? false,
        });
      }
      setProfiles(map);
    } else {
      setProfiles(new Map());
    }
  }, []);

  useEffect(() => {
    refresh();
    // Re-poll every 30s so the list reflects new games starting /
    // ending without manual reload. 30s feels live enough for a
    // watch list without hammering the DB.
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!supabase) return null;

  const body = (
    <div className="help-body">
      {games.length === 0 && (
        <p className="lobby-hint">
          No public games right now. Tournament games appear here
          automatically while they're being played.
        </p>
      )}
      {games.map((g) => {
        const p1 = g.p1_id ? profiles.get(g.p1_id) : null;
        const p2 = g.p2_id ? profiles.get(g.p2_id) : null;
        const turn = g.state?.turnNumber ?? 1;
        return (
          <a
            key={g.room_code}
            href={`/watch/${g.room_code}`}
            className="spectator-row"
          >
            <div className="spectator-players">
              <span className="spectator-player">
                {p1?.nickname ?? '—'}
                <PlusBadge isPlus={p1?.is_plus} />
                <span className="spectator-rating">{p1?.rating ?? 1200}</span>
              </span>
              <span className="spectator-vs">vs</span>
              <span className="spectator-player">
                {p2?.nickname ?? '—'}
                <PlusBadge isPlus={p2?.is_plus} />
                <span className="spectator-rating">{p2?.rating ?? 1200}</span>
              </span>
            </div>
            <div className="spectator-meta">
              Turn {turn} · Watch →
            </div>
          </a>
        );
      })}
    </div>
  );

  if (inline) return body;
  return (
    <details className="help">
      <summary className="help-summary">Spectate</summary>
      {body}
    </details>
  );
}
