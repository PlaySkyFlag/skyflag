// Real-time lobby — shows who is currently online and "looking for a game",
// lets the signed-in user toggle their own availability, click another
// player to challenge them, and receive incoming challenges with an
// Accept/Decline modal.
//
// Built on Supabase Realtime: a single channel `lobby:global` is used for
// both presence (who's available) and broadcast (challenge / accept /
// decline events).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createInitialGameState } from './game/constants';
import {
  currentPresence as currentLobbyPresence,
  sendBroadcast as sendLobbyBroadcast,
  setAvailable as setLobbyAvailable,
  subscribeBroadcast as subscribeLobbyBroadcast,
  subscribePresence as subscribeLobbyPresence,
} from './game/lobbyChannel';
import { supabase } from './game/supabase';
import type { Profile } from './game/profile';
import type { RoomState } from './game/types';

// Quick-match pool — separate from `lobby:global` so being challengeable
// (named) doesn't auto-pair you, and being in the pool doesn't expose
// you to direct challenges. Pairing rule: when ≥2 peers are in the pool,
// the peer with the lowest user_id is host; it inserts the games row and
// broadcasts a `pair` envelope to its chosen opponent. This is fully
// deterministic, so multiple peers can't race to create duplicate rooms.
const POOL_CHANNEL = 'matchmaking:pool';
// Auto-cancel a search after 5 minutes so a forgotten Quick-match doesn't
// silently match a player who has wandered off.
const POOL_TIMEOUT_MS = 5 * 60 * 1000;

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

type Presence = {
  user_id: string;
  nickname: string;
};

type Challenge = {
  from_user_id: string;
  from_nickname: string;
  to_user_id: string;
  room_code: string;
};

type PoolEntry = {
  user_id: string;
  nickname: string;
  joined_at: number;
};

// Sent by the host (canonical lowest user_id) to the peer it's pairing
// with. Only the addressed user acts on it; everyone else ignores.
type PairEvent = {
  to_user_id: string;
  from_user_id: string;
  from_nickname: string;
  room_code: string;
};

type Props = {
  user: User;
  profile: Profile | null;
  // True when the user is already in a room — disables challenges so they
  // don't accidentally get pulled into a second game.
  inRoom: boolean;
  // Called when a challenge is accepted (either side) and the room is ready
  // to enter. The parent App switches to the room state.
  onEnterRoom: (room: RoomState) => void;
  // Bubbles up the set of currently-online user ids so other panels
  // (Friends) can show online status without subscribing to the same
  // channel themselves — Supabase reuses one channel per topic, so a
  // second subscriber would fail to attach presence listeners.
  onPresenceChange?: (ids: Set<string>) => void;
};

export default function Lobby({ user, profile, inRoom, onEnterRoom, onPresenceChange }: Props) {
  const [available, setAvailable] = useState(false);
  const [online, setOnline] = useState<Presence[]>([]);
  const [incoming, setIncoming] = useState<Challenge | null>(null);
  const [outgoing, setOutgoing] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick-match pool state. `searching` drives the UI ("Searching…" /
  // "Cancel"); `pairedRef` is a one-shot guard so the presence-sync
  // handler and the broadcast-`pair` handler don't both try to enter
  // a room (the host's own sync handler fires first and pairs; the
  // recipient's broadcast handler then needs to know "I've already
  // entered the room, ignore further sync events").
  const [searching, setSearching] = useState(false);
  const pairedRef = useRef(false);

  // The Quick-match pool channel uses its own topic so the
  // singleton lobby:global subscription isn't affected.
  const poolChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  // Subscribe to the lobby:global manager. The actual Supabase
  // channel is owned by App.tsx via lobbyChannel.ts; we just
  // register listeners and call the manager's helpers.
  useEffect(() => {
    if (!user) return;
    // Hydrate from the manager's last-known presence so we render
    // a sensible initial list even before the next sync fires.
    const initial = currentLobbyPresence();
    if (initial.size > 0) {
      const list: Presence[] = [];
      for (const m of initial.values()) list.push(m);
      setOnline(list);
      onPresenceChange?.(new Set(list.map((p) => p.user_id)));
    }

    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribeLobbyPresence((members) => {
        const list: Presence[] = [];
        for (const m of members.values()) list.push(m);
        setOnline(list);
        // Mirror the presence set up to App so siblings (Friends panel)
        // can show an online dot without spinning up their own channel.
        onPresenceChange?.(new Set(list.map((p) => p.user_id)));
      }),
    );

    unsubs.push(
      subscribeLobbyBroadcast('challenge', (payload) => {
        const c = payload as Challenge;
        if (c.to_user_id !== user.id) return;
        setIncoming(c);
      }),
    );
    unsubs.push(
      subscribeLobbyBroadcast('challenge-cancel', (payload) => {
        const c = payload as Challenge;
        if (c.to_user_id !== user.id) return;
        setIncoming((prev) => (prev && prev.from_user_id === c.from_user_id ? null : prev));
      }),
    );
    unsubs.push(
      subscribeLobbyBroadcast('challenge-decline', (payload) => {
        const c = payload as Challenge;
        if (c.from_user_id !== user.id) return;
        setOutgoing((prev) => (prev && prev.to_user_id === c.to_user_id ? null : prev));
        setError(`${c.from_nickname || 'They'} declined the challenge.`);
        setTimeout(() => setError(null), 3000);
      }),
    );
    unsubs.push(
      subscribeLobbyBroadcast('challenge-accept', (payload) => {
        // Recipient accepted — close our "Challenging…" overlay and
        // hand the room up to App so the challenger also enters it.
        const c = payload as Challenge;
        if (c.from_user_id !== user.id) return;
        setOutgoing(null);
        setAvailable(false);
        onEnterRoom({
          code: c.room_code,
          role: 'p1',
          status: 'playing',
        });
      }),
    );

    return () => {
      for (const fn of unsubs) fn();
    };
  }, [user, onEnterRoom, onPresenceChange]);

  // Track / untrack our own presence whenever the availability toggle flips.
  useEffect(() => {
    if (!profile) return;
    setLobbyAvailable(available);
  }, [available, profile]);

  // Auto-untrack when this component unmounts so a closing tab doesn't
  // leave a stale presence row hanging.
  useEffect(() => {
    return () => {
      setLobbyAvailable(false);
    };
  }, []);

  // ── Quick-match pool ─────────────────────────────────────────────────
  // Subscribe to the pool channel and listen for two things:
  //   1) presence sync — if ≥2 peers are present and *I'm* the lowest
  //      user_id (deterministic host), insert a games row and broadcast
  //      a `pair` envelope to the second-lowest peer.
  //   2) broadcast `pair` addressed to me — enter the room as p2.
  //
  // The host's own sync handler will see the pool, host-pair, and enter
  // as p1 in one shot. The recipient gets the broadcast and enters as
  // p2. `pairedRef` is a one-shot guard so neither side double-fires.
  useEffect(() => {
    if (!supabase || !user) return;
    const sb = supabase;
    const channel = sb.channel(POOL_CHANNEL, {
      config: { presence: { key: user.id } },
    });
    poolChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        if (pairedRef.current) return;
        const raw = channel.presenceState() as Record<string, PoolEntry[]>;
        const seen = new Set<string>();
        const list: PoolEntry[] = [];
        for (const arr of Object.values(raw)) {
          for (const meta of arr) {
            if (seen.has(meta.user_id)) continue;
            seen.add(meta.user_id);
            list.push(meta);
          }
        }
        // Only act if I'm currently in the pool. Avoids stale-closure
        // checks against the `searching` state.
        if (!list.some((p) => p.user_id === user.id)) return;
        if (list.length < 2) return;
        // Canonical sort: lowest user_id is host. Both peers compute
        // the same ordering and only the host takes action, so no race.
        list.sort((a, b) => a.user_id.localeCompare(b.user_id));
        const host = list[0];
        const opp = list[1];
        if (host.user_id !== user.id) return; // not my turn to host
        pairedRef.current = true;
        void hostPairRef.current?.(opp);
      })
      .on('broadcast', { event: 'pair' }, ({ payload }) => {
        const ev = payload as PairEvent;
        if (ev.to_user_id !== user.id || pairedRef.current) return;
        pairedRef.current = true;
        setSearching(false);
        channel.untrack();
        onEnterRoom({
          code: ev.room_code,
          role: 'p2',
          status: 'playing',
        });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      poolChannelRef.current = null;
    };
  }, [user, onEnterRoom]);

  // Track / untrack our own pool presence whenever the searching toggle
  // flips. Re-arms `pairedRef` on entry so a previous successful pairing
  // doesn't silently block the next search.
  useEffect(() => {
    const channel = poolChannelRef.current;
    if (!channel || !profile) return;
    if (searching) {
      pairedRef.current = false;
      channel.track({
        user_id: user.id,
        nickname: profile.nickname,
        joined_at: Date.now(),
      });
    } else {
      channel.untrack();
    }
  }, [searching, user, profile]);

  // 5-minute idle cancel — abandons the search if no pairing happens
  // and surfaces a hint so the user knows why the spinner stopped.
  useEffect(() => {
    if (!searching) return;
    const id = window.setTimeout(() => {
      setSearching(false);
      setError('No match found in 5 minutes — try again later.');
      window.setTimeout(() => setError(null), 5000);
    }, POOL_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [searching]);

  // Auto-untrack on unmount so a closed tab doesn't leave a stale pool
  // row that would mis-pair the next searcher.
  useEffect(() => {
    return () => {
      poolChannelRef.current?.untrack();
    };
  }, []);

  // hostPair lives in a ref so the long-lived `presence sync` handler
  // (registered once at mount) can call the latest version without
  // needing to be re-registered every time `profile` or `inRoom`
  // changes — which would re-subscribe and lose the connection.
  const hostPairRef = useRef<((opp: PoolEntry) => Promise<void>) | null>(null);
  hostPairRef.current = useCallback(
    async (opp: PoolEntry) => {
      if (!supabase || !profile) return;
      if (inRoom) {
        // Shouldn't happen — UI disables Quick match in-room — but guard
        // anyway so we don't strand a games row if state slips.
        pairedRef.current = false;
        return;
      }
      const sb = supabase;
      const code = generateRoomCode();
      const insertResult = await sb
        .from('games')
        .insert({
          room_code: code,
          state: createInitialGameState(),
          p1_id: user.id,
          p2_id: opp.user_id,
        })
        .select('*')
        .single();
      if (insertResult.error) {
        setError(`Couldn't create match: ${insertResult.error.message}`);
        pairedRef.current = false;
        return;
      }
      const channel = poolChannelRef.current;
      if (!channel) {
        pairedRef.current = false;
        return;
      }
      // Send the pair envelope BEFORE entering the room — once we
      // unmount, the broadcast won't go out.
      await channel.send({
        type: 'broadcast',
        event: 'pair',
        payload: {
          to_user_id: opp.user_id,
          from_user_id: user.id,
          from_nickname: profile.nickname,
          room_code: code,
        } satisfies PairEvent,
      });
      setSearching(false);
      channel.untrack();
      onEnterRoom({ code, role: 'p1', status: 'playing' });
    },
    [user, profile, inRoom, onEnterRoom],
  );

  // ── Challenger flow ──────────────────────────────────────────────────
  const challenge = useCallback(
    async (target: Presence) => {
      if (!supabase || !profile) return;
      if (inRoom) {
        setError("You're already in a room — leave it first.");
        return;
      }

      // Create the room on Supabase with us as p1 and target user as p2_id.
      // The opponent's client will join by code when they accept.
      const code = generateRoomCode();
      const insertResult = await supabase
        .from('games')
        .insert({
          room_code: code,
          state: createInitialGameState(),
          p1_id: user.id,
          p2_id: target.user_id,
        })
        .select('*')
        .single();
      if (insertResult.error) {
        setError(`Couldn't create room: ${insertResult.error.message}`);
        return;
      }

      const payload: Challenge = {
        from_user_id: user.id,
        from_nickname: profile.nickname,
        to_user_id: target.user_id,
        room_code: code,
      };
      setOutgoing(payload);
      await sendLobbyBroadcast('challenge', payload);
    },
    [user, profile, inRoom],
  );

  const cancelOutgoing = useCallback(async () => {
    if (!supabase || !outgoing) return;
    await sendLobbyBroadcast('challenge-cancel', outgoing);
    // Tear down the room we created since it'll never be joined.
    await supabase.from('games').delete().eq('room_code', outgoing.room_code);
    setOutgoing(null);
  }, [outgoing]);

  // ── Recipient flow ───────────────────────────────────────────────────
  const acceptIncoming = useCallback(async () => {
    if (!supabase || !incoming) return;
    // Notify the challenger so their "Challenging…" overlay clears and
    // they also enter the room. Without this broadcast their UI stays
    // stuck behind a full-screen modal blocking every click.
    await sendLobbyBroadcast('challenge-accept', incoming);
    // Joining the room is identical to typing the code in by hand, so we
    // hand the room state up to the parent and let the existing room flow
    // take over (sync, render, etc.).
    onEnterRoom({
      code: incoming.room_code,
      role: 'p2',
      status: 'playing',
    });
    setIncoming(null);
    setAvailable(false);
  }, [incoming, onEnterRoom]);

  const declineIncoming = useCallback(async () => {
    if (!incoming) return;
    await sendLobbyBroadcast('challenge-decline', incoming);
    if (supabase) {
      // The challenger's room is now orphaned — clean it up so it doesn't
      // count toward their open rooms.
      await supabase.from('games').delete().eq('room_code', incoming.room_code);
    }
    setIncoming(null);
  }, [incoming]);

  if (!profile) {
    return (
      <p className="lobby-hint">
        Sign in and create a profile to use the lobby.
      </p>
    );
  }

  const others = online.filter((p) => p.user_id !== user.id);

  return (
    <div className="lobby">
      <div className="lobby-toggle-row">
        <label className="lobby-toggle">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
            disabled={inRoom || searching || !profile}
            title={!profile ? 'Loading your profile…' : undefined}
          />
          <span>I'm looking for a game</span>
        </label>
        <span className="lobby-count">
          {others.length} other{others.length === 1 ? '' : 's'} online
        </span>
      </div>

      <div className="lobby-quickmatch">
        {searching ? (
          <>
            <span className="lobby-searching" aria-live="polite">
              ⏳ Searching for a match…
            </span>
            <button
              type="button"
              className="end-game-btn end-game-btn--subtle"
              onClick={() => setSearching(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="hud-btn"
            disabled={inRoom || outgoing !== null || incoming !== null || !profile}
            onClick={() => setSearching(true)}
            title={
              !profile
                ? 'Loading your profile…'
                : 'Auto-pair with the next player who hits Quick match'
            }
          >
            ⚡ Quick match
          </button>
        )}
      </div>

      {available ? (
        others.length === 0 ? (
          <p className="lobby-hint">Waiting for someone else to come online…</p>
        ) : (
          <ul className="lobby-list">
            {others.map((p) => (
              <li key={p.user_id} className="lobby-row">
                <span className="lobby-nickname">{p.nickname}</span>
                <button
                  type="button"
                  className="hud-btn"
                  disabled={inRoom || outgoing !== null}
                  onClick={() => challenge(p)}
                >
                  Challenge
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="lobby-hint">
          Toggle on to be visible to other players. Single-player and 2P
          hot-seat are unaffected.
        </p>
      )}

      {error && <p className="mp-error">⚠ {error}</p>}

      {outgoing && (
        <div className="account-overlay" role="dialog" aria-modal="true">
          <div className="account-card">
            <h2 className="account-title">Challenging…</h2>
            <p className="account-intro">
              Waiting for <strong>{outgoing.to_user_id.slice(0, 8)}</strong> to
              accept. Room code: <strong className="mp-code">{outgoing.room_code}</strong>
            </p>
            <div className="account-actions">
              <button
                type="button"
                className="end-game-btn end-game-btn--subtle"
                onClick={cancelOutgoing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {incoming && (
        <div className="account-overlay" role="dialog" aria-modal="true">
          <div className="account-card">
            <h2 className="account-title">Challenge from {incoming.from_nickname}</h2>
            <p className="account-intro">
              {incoming.from_nickname} invited you to play 3phor. Room{' '}
              <strong className="mp-code">{incoming.room_code}</strong>.
            </p>
            <div className="account-actions">
              <button type="button" className="end-game-btn" onClick={acceptIncoming}>
                Accept
              </button>
              <button
                type="button"
                className="end-game-btn end-game-btn--subtle"
                onClick={declineIncoming}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
