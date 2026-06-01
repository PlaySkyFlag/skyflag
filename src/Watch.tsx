// Spectator watch view — read-only live board for a public game.
// Mounted at /watch/<room_code> via main.tsx routing.
//
// Re-uses the same Board component the players see, with all click
// handlers omitted so the spectator can't perturb the game. Subscribes
// to postgres_changes on the games row so moves animate live.

import { useEffect, useState } from 'react';
import Board, { type BoardTheme, type Marker } from './Board';
import PlusBadge from './PlusBadge';
import KickstarterCTA from './KickstarterCTA';
import { supabase } from './game/supabase';
import {
  DEPLOY_COORDS,
  FLAG_COORDS,
  LAYER_ORDER,
  LIFT_CELLS,
  NEXUS_COORD,
} from './game/constants';
import {
  applyThemeToCssVars,
  loadThemeId,
  THEMES,
  type ThemeId,
} from './game/themes';
import type { GameState, Layer, Player, PieceKind } from './game/types';
import './App.css';

const LAYER_NAMES: Record<Layer, string> = {
  space: 'Space / Empyrean',
  sky: 'Sky / Meridian',
  ground: 'Ground / Terran',
};

const PLAYERS: Player[] = ['p1', 'p2'];

const PIECE_SYMBOL: Record<PieceKind, string> = {
  captain: '♚',
  soldier: '♟',
  rover:   '♜',
  pilot:   '♝',
};

const flagSymbol = (_layer: Layer): string => '⚑';

type PlayerMeta = {
  nickname: string;
  rating: number;
  is_plus: boolean;
};

function layerThemesFor(themeId: ThemeId): Record<Layer, BoardTheme> {
  const t = THEMES[themeId].layers;
  return {
    space:  { ...t.space,  kind: 'space'  },
    sky:    { ...t.sky,    kind: 'sky'    },
    ground: { ...t.ground, kind: 'ground' },
  };
}

function markersForLayer(layer: Layer, state: GameState): Marker[] {
  const markers: Marker[] = [];
  for (const cell of LIFT_CELLS) {
    markers.push({ row: cell.row, col: cell.col, symbol: '⬆', kind: 'lift' });
  }
  for (const player of PLAYERS) {
    if (!state.flags[layer][player]) {
      const pos = FLAG_COORDS[player][layer];
      markers.push({ row: pos.row, col: pos.col, symbol: flagSymbol(layer), kind: player });
    }
  }
  if (layer === 'space') {
    markers.push({ row: NEXUS_COORD.row, col: NEXUS_COORD.col, symbol: '◎', kind: 'nexus' });
  }
  for (const bp of state.onBoard) {
    if (bp.coord.layer !== layer) continue;
    const badge = bp.piece.kind === 'captain' && bp.piece.promotedFromSoldier ? '★' : undefined;
    markers.push({
      row: bp.coord.row,
      col: bp.coord.col,
      symbol: PIECE_SYMBOL[bp.piece.kind],
      kind: bp.piece.owner,
      badge,
      id: bp.piece.id,
    });
  }
  return markers;
}

function deployCellsFor(layer: Layer) {
  if (layer !== 'ground') return [];
  return PLAYERS.map((player) => ({
    row: DEPLOY_COORDS[player].row,
    col: DEPLOY_COORDS[player].col,
    player,
  }));
}

function formatClock(ms: number | undefined): string {
  if (ms === undefined) return '';
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Watch() {
  const roomCode = window.location.pathname.replace(/^\/watch\/?/, '').replace(/\/$/, '');
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [p1Meta, setP1Meta] = useState<PlayerMeta | null>(null);
  const [p2Meta, setP2Meta] = useState<PlayerMeta | null>(null);

  const themeId = loadThemeId();
  useEffect(() => {
    applyThemeToCssVars(themeId);
  }, [themeId]);
  const layerThemes = layerThemesFor(themeId);

  useEffect(() => {
    if (!supabase || !roomCode) return;
    const sb = supabase;
    let mounted = true;

    sb.from('games')
      .select('p1_id, p2_id, state, is_public')
      .eq('room_code', roomCode)
      .maybeSingle()
      .then(async ({ data, error: gErr }) => {
        if (!mounted) return;
        if (gErr || !data) {
          setError("Couldn't load this game. It may have ended or be private.");
          return;
        }
        if (!data.is_public) {
          setError('This game is private — only the players can see it.');
          return;
        }
        setState(data.state as GameState);
        // Fetch both player profiles.
        const ids = [data.p1_id, data.p2_id].filter(Boolean) as string[];
        if (ids.length > 0) {
          const { data: profs } = await sb
            .from('profiles')
            .select('id, nickname, rating, is_plus')
            .in('id', ids);
          for (const p of (profs ?? []) as { id: string; nickname: string; rating: number; is_plus: boolean | null }[]) {
            const meta: PlayerMeta = {
              nickname: p.nickname,
              rating: p.rating,
              is_plus: p.is_plus ?? false,
            };
            if (p.id === data.p1_id) setP1Meta(meta);
            if (p.id === data.p2_id) setP2Meta(meta);
          }
        }
      });

    // Postgres-changes channel and presence channel share a topic
    // namespace but use distinct topics, so supabase-js doesn't
    // dedupe them into a single shared instance (see the
    // `room:` ↔ `room-broadcast:` split in App.tsx for the same
    // bug class). Per-effect-run suffix on the postgres topic so
    // StrictMode double-mount can't collide either.
    const watchSuffix = Math.random().toString(36).slice(2, 10);
    const channel = sb
      .channel(`watch:${roomCode}:${watchSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const newRow = payload.new as { state: GameState; is_public: boolean };
          if (!newRow.is_public) {
            setError('This game is no longer public.');
            return;
          }
          setState(newRow.state);
        },
      )
      .subscribe();

    // Presence channel — the spectator tracks themselves on a
    // per-room presence channel so the players' clients can count
    // viewers and show a "X watching" pill. Uses a random key so
    // the same user across multiple tabs registers as multiple
    // distinct presences (matches what the players will count as
    // "people watching", not "users watching").
    const presenceKey = `s_${Math.random().toString(36).slice(2, 10)}`;
    const presenceChannel = sb
      .channel(`watch-presence:${roomCode}`, {
        config: { presence: { key: presenceKey } },
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ at: Date.now() });
        }
      });

    // Belt-and-suspenders de-publish detection. The postgres-changes
    // handler above catches the UPDATE that flips is_public → false,
    // but Realtime delivery depends on RLS evaluating against the new
    // row state. If the policy filters out post-private updates the
    // spectator never sees the kick event and sits indefinitely on
    // the last public snapshot. A 30-second poll closes that window:
    // if the row is no longer visible (RLS yanked it) or comes back
    // with is_public=false, surface the same error and stop refresh.
    const publicCheck = window.setInterval(() => {
      sb
        .from('games')
        .select('is_public')
        .eq('room_code', roomCode)
        .maybeSingle()
        .then(({ data }) => {
          if (!mounted) return;
          if (!data || !data.is_public) {
            setError('This game is no longer public.');
          }
        });
    }, 30_000);

    return () => {
      mounted = false;
      window.clearInterval(publicCheck);
      sb.removeChannel(channel);
      sb.removeChannel(presenceChannel);
    };
  }, [roomCode]);

  if (error) {
    return (
      <main className="app watch-app">
        <div className="watch-error">
          <h2>Couldn't watch this game</h2>
          <p>{error}</p>
          <a href="/play" className="hud-btn">Back to the game</a>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="app watch-app">
        <p className="lobby-hint">Loading game…</p>
      </main>
    );
  }

  const winner = state.status.kind === 'won' ? state.status.winner : null;

  return (
    <main className="app watch-app">
      <header className="app-header">
        <h1 className="watch-title">Watching · room {roomCode}</h1>
        <p className="watch-sub">Spectator view · read-only</p>
      </header>

      <div className="watch-players">
        <div className={`watch-player ${state.currentPlayer === 'p1' && state.status.kind === 'in-progress' ? 'watch-player-active' : ''}`}>
          <strong>{p1Meta?.nickname ?? 'Player 1'}<PlusBadge isPlus={p1Meta?.is_plus} /></strong>
          <span>Rating {p1Meta?.rating ?? 1200}</span>
          {state.clock && <span className="watch-clock">{formatClock(state.clock.p1Ms)}</span>}
          {winner === 'p1' && <span className="watch-winner">★ Winner</span>}
        </div>
        <div className={`watch-player ${state.currentPlayer === 'p2' && state.status.kind === 'in-progress' ? 'watch-player-active' : ''}`}>
          <strong>{p2Meta?.nickname ?? 'Player 2'}<PlusBadge isPlus={p2Meta?.is_plus} /></strong>
          <span>Rating {p2Meta?.rating ?? 1200}</span>
          {state.clock && <span className="watch-clock">{formatClock(state.clock.p2Ms)}</span>}
          {winner === 'p2' && <span className="watch-winner">★ Winner</span>}
        </div>
      </div>

      <div className="board-stack">
        {LAYER_ORDER.map((layer) => (
          <div className={`board-stack-item board-stack-item--${layer}`} key={layer}>
            <span className="board-stack-label">{LAYER_NAMES[layer]}</span>
            <div className="board-stack-tile">
              <Board
                theme={layerThemes[layer]}
                markers={markersForLayer(layer, state)}
                deployCells={deployCellsFor(layer)}
                activeDeployPlayer={null}
                selectedCell={null}
                legalTargets={[]}
                onCellClick={() => undefined}
              />
            </div>
          </div>
        ))}
      </div>

      <KickstarterCTA />

      <footer className="app-footer">
        <p>
          <a href="/play">← Back to the game</a> · <a href="/">Skyflag</a> ·{' '}
          <a href="/ai-use">AI use</a>
        </p>
      </footer>
    </main>
  );
}
