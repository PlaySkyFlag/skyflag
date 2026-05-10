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
import { supabase } from './game/supabase';
import type { Profile } from './game/profile';
import type { RoomState } from './game/types';

const LOBBY_CHANNEL = 'lobby:global';
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

  // The Supabase channel is held in a ref so we can `track` / `untrack` and
  // send broadcasts without re-creating it on every render. Recreated only
  // when the user identity changes.
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  // Subscribe to the lobby channel once per signed-in user. Listens for
  // presence sync (who's available) and broadcasts (challenge envelopes).
  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase.channel(LOBBY_CHANNEL, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const raw = channel.presenceState() as Record<string, Presence[]>;
        // presenceState gives us { [presenceKey]: [meta, ...] }. Each meta
        // is the object we passed to track(). Flatten + dedupe by user_id
        // so two tabs of the same user appear as one row.
        const seen = new Set<string>();
        const list: Presence[] = [];
        for (const arr of Object.values(raw)) {
          for (const meta of arr) {
            if (seen.has(meta.user_id)) continue;
            seen.add(meta.user_id);
            list.push(meta);
          }
        }
        setOnline(list);
        // Mirror the presence set up to App so siblings (Friends panel)
        // can show an online dot without spinning up their own channel.
        if (onPresenceChange) {
          onPresenceChange(new Set(list.map((p) => p.user_id)));
        }
      })
      .on('broadcast', { event: 'challenge' }, ({ payload }) => {
        const c = payload as Challenge;
        if (c.to_user_id !== user.id) return;
        setIncoming(c);
      })
      .on('broadcast', { event: 'challenge-cancel' }, ({ payload }) => {
        const c = payload as Challenge;
        if (c.to_user_id !== user.id) return;
        setIncoming((prev) => (prev && prev.from_user_id === c.from_user_id ? null : prev));
      })
      .on('broadcast', { event: 'challenge-decline' }, ({ payload }) => {
        const c = payload as Challenge;
        if (c.from_user_id !== user.id) return;
        setOutgoing((prev) => (prev && prev.to_user_id === c.to_user_id ? null : prev));
        setError(`${c.from_nickname || 'They'} declined the challenge.`);
        setTimeout(() => setError(null), 3000);
      })
      .on('broadcast', { event: 'challenge-accept' }, ({ payload }) => {
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
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user]);

  // Track / untrack our own presence whenever the availability toggle flips.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !profile) return;
    if (available) {
      channel.track({ user_id: user.id, nickname: profile.nickname });
    } else {
      channel.untrack();
    }
  }, [available, user, profile]);

  // Auto-untrack when this component unmounts so a closing tab doesn't
  // leave a stale presence row hanging.
  useEffect(() => {
    return () => {
      channelRef.current?.untrack();
    };
  }, []);

  // ── Challenger flow ──────────────────────────────────────────────────
  const challenge = useCallback(
    async (target: Presence) => {
      if (!supabase || !profile) return;
      if (inRoom) {
        setError("You're already in a room — leave it first.");
        return;
      }
      const channel = channelRef.current;
      if (!channel) return;

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
      await channel.send({ type: 'broadcast', event: 'challenge', payload });
    },
    [user, profile, inRoom],
  );

  const cancelOutgoing = useCallback(async () => {
    if (!supabase || !outgoing) return;
    const channel = channelRef.current;
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'challenge-cancel',
        payload: outgoing,
      });
    }
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
    const channel = channelRef.current;
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'challenge-accept',
        payload: incoming,
      });
    }
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
    const channel = channelRef.current;
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'challenge-decline',
        payload: incoming,
      });
    }
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
            disabled={inRoom}
          />
          <span>I'm looking for a game</span>
        </label>
        <span className="lobby-count">
          {others.length} other{others.length === 1 ? '' : 's'} online
        </span>
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
