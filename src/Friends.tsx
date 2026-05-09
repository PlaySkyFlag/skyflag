// Friends panel — accepted friends, pending requests in/out, and an
// "add by nickname" form. Friends shown as online when they're currently
// tracked on the lobby:global presence channel get a Challenge button
// that creates a room and broadcasts a challenge envelope (same path the
// Lobby uses).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  acceptRequest,
  findProfileByNickname,
  listFriends,
  removeFriendship,
  sendRequest,
  type FriendEntry,
} from './game/friends';
import { createInitialGameState } from './game/constants';
import type { Profile } from './game/profile';
import { supabase } from './game/supabase';
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

type Props = {
  user: User | null;
  profile: Profile | null;
  inRoom: boolean;
  onEnterRoom: (room: RoomState) => void;
};

type Outgoing = {
  to_user_id: string;
  to_nickname: string;
  room_code: string;
};

export default function Friends({ user, profile, inRoom, onEnterRoom }: Props) {
  const [entries, setEntries] = useState<FriendEntry[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [addInput, setAddInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [outgoing, setOutgoing] = useState<Outgoing | null>(null);

  // Read-only subscription to the lobby presence channel so we can show
  // a green dot beside friends who are currently online. We never call
  // track() here — that's Lobby's job, owned by the user's "I'm looking
  // for a game" toggle.
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setEntries([]);
      return;
    }
    const list = await listFriends(user.id);
    setEntries(list);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase.channel(LOBBY_CHANNEL, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const raw = channel.presenceState() as Record<string, { user_id: string }[]>;
        const ids = new Set<string>();
        for (const arr of Object.values(raw)) {
          for (const meta of arr) ids.add(meta.user_id);
        }
        setOnlineIds(ids);
      })
      .on('broadcast', { event: 'challenge-accept' }, ({ payload }) => {
        // If we initiated a challenge from here and they accept, App's
        // Lobby listener also fires — but Friends owns the outgoing
        // state in this panel, so clear it ourselves too. The
        // onEnterRoom call in Lobby handles the actual room transition.
        const c = payload as { from_user_id: string; to_user_id: string; room_code: string };
        if (c.from_user_id !== user.id) return;
        setOutgoing((prev) => (prev && prev.room_code === c.room_code ? null : prev));
      })
      .on('broadcast', { event: 'challenge-decline' }, ({ payload }) => {
        const c = payload as { from_user_id: string; to_user_id: string };
        if (c.from_user_id !== user.id) return;
        setOutgoing((prev) => (prev && prev.to_user_id === c.to_user_id ? null : prev));
        setError('Challenge declined.');
        setTimeout(() => setError(null), 3000);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user]);

  const onAdd = useCallback(async () => {
    if (!user || !profile) return;
    const nick = addInput.trim();
    if (!nick) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const target = await findProfileByNickname(nick);
    if (!target) {
      setBusy(false);
      setError(`No player found with nickname "${nick}".`);
      return;
    }
    const r = await sendRequest(user.id, target.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setAddInput('');
    setInfo(`Friend request sent to ${target.nickname}.`);
    setTimeout(() => setInfo(null), 3000);
    refresh();
  }, [user, profile, addInput, refresh]);

  const onAccept = useCallback(
    async (otherId: string) => {
      if (!user) return;
      const r = await acceptRequest(user.id, otherId);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      refresh();
    },
    [user, refresh],
  );

  const onRemove = useCallback(
    async (otherId: string, kind: 'decline' | 'cancel' | 'unfriend') => {
      if (!user) return;
      const labels = {
        decline: 'Decline this request?',
        cancel: 'Cancel this request?',
        unfriend: 'Remove this friend?',
      };
      if (!confirm(labels[kind])) return;
      const r = await removeFriendship(user.id, otherId);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      refresh();
    },
    [user, refresh],
  );

  const onChallenge = useCallback(
    async (other: FriendEntry) => {
      if (!supabase || !user || !profile) return;
      if (inRoom) {
        setError("You're already in a room — leave it first.");
        return;
      }
      const channel = channelRef.current;
      if (!channel) return;
      setBusy(true);
      setError(null);
      const code = generateRoomCode();
      const insertResult = await supabase
        .from('games')
        .insert({
          room_code: code,
          state: createInitialGameState(),
          p1_id: user.id,
          p2_id: other.other_id,
        })
        .select('*')
        .single();
      setBusy(false);
      if (insertResult.error) {
        setError(`Couldn't create room: ${insertResult.error.message}`);
        return;
      }
      const out: Outgoing = {
        to_user_id: other.other_id,
        to_nickname: other.other_nickname,
        room_code: code,
      };
      setOutgoing(out);
      // Same envelope shape Lobby uses, so the recipient's existing
      // Lobby challenge listener pops up the Accept/Decline modal.
      await channel.send({
        type: 'broadcast',
        event: 'challenge',
        payload: {
          from_user_id: user.id,
          from_nickname: profile.nickname,
          to_user_id: other.other_id,
          room_code: code,
        },
      });
      // The actual room transition (when they accept) is driven by the
      // Lobby's challenge-accept listener which calls onEnterRoom. Pass
      // the same callback through here in case Lobby is unmounted at
      // the moment of acceptance — belt-and-suspenders.
      void onEnterRoom;
    },
    [user, profile, inRoom, onEnterRoom],
  );

  const onCancelOutgoing = useCallback(async () => {
    if (!supabase || !outgoing) return;
    const channel = channelRef.current;
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'challenge-cancel',
        payload: {
          from_user_id: user?.id,
          to_user_id: outgoing.to_user_id,
          room_code: outgoing.room_code,
        },
      });
    }
    await supabase.from('games').delete().eq('room_code', outgoing.room_code);
    setOutgoing(null);
  }, [outgoing, user]);

  if (!supabase) return null;

  if (!user || !profile) {
    return (
      <details className="help">
        <summary className="help-summary">Friends</summary>
        <div className="help-body">
          <p className="lobby-hint">Sign in and create a profile to add friends.</p>
        </div>
      </details>
    );
  }

  const accepted = entries.filter((e) => e.direction === 'accepted');
  const incoming = entries.filter((e) => e.direction === 'pending-in');
  const outgoingList = entries.filter((e) => e.direction === 'pending-out');

  return (
    <details className="help">
      <summary className="help-summary">
        Friends{' '}
        {incoming.length > 0 && (
          <span className="friends-badge" title={`${incoming.length} pending request(s)`}>
            {incoming.length}
          </span>
        )}
      </summary>
      <div className="help-body">
        <div className="friends-add-row">
          <input
            type="text"
            className="friends-input"
            placeholder="Add by nickname"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAdd();
            }}
          />
          <button
            type="button"
            className="hud-btn"
            disabled={busy || !addInput.trim()}
            onClick={onAdd}
          >
            Add
          </button>
        </div>
        {info && <p className="friends-info">{info}</p>}
        {error && <p className="mp-error">⚠ {error}</p>}

        {incoming.length > 0 && (
          <>
            <h4 className="friends-section-title">Requests ({incoming.length})</h4>
            <ul className="friends-list">
              {incoming.map((f) => (
                <li key={f.other_id} className="friends-row">
                  <span className="friends-nickname">
                    {f.other_nickname}{' '}
                    <span className="friends-rating">{f.other_rating}</span>
                  </span>
                  <span className="friends-actions">
                    <button
                      type="button"
                      className="hud-btn"
                      onClick={() => onAccept(f.other_id)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="hud-btn hud-btn-subtle"
                      onClick={() => onRemove(f.other_id, 'decline')}
                    >
                      Decline
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {outgoingList.length > 0 && (
          <>
            <h4 className="friends-section-title">Sent</h4>
            <ul className="friends-list">
              {outgoingList.map((f) => (
                <li key={f.other_id} className="friends-row">
                  <span className="friends-nickname">
                    {f.other_nickname}{' '}
                    <span className="friends-pending-tag">pending</span>
                  </span>
                  <button
                    type="button"
                    className="hud-btn hud-btn-subtle"
                    onClick={() => onRemove(f.other_id, 'cancel')}
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h4 className="friends-section-title">Friends ({accepted.length})</h4>
        {accepted.length === 0 ? (
          <p className="lobby-hint">No friends yet — add someone by nickname above.</p>
        ) : (
          <ul className="friends-list">
            {accepted.map((f) => {
              const online = onlineIds.has(f.other_id);
              return (
                <li key={f.other_id} className="friends-row">
                  <span className="friends-nickname">
                    <span
                      className={`friends-dot${online ? ' friends-dot-online' : ''}`}
                      aria-hidden
                    />
                    {f.other_nickname}{' '}
                    <span className="friends-rating">{f.other_rating}</span>
                  </span>
                  <span className="friends-actions">
                    <button
                      type="button"
                      className="hud-btn"
                      disabled={!online || inRoom || busy || outgoing !== null}
                      title={online ? 'Send a challenge' : 'Friend is offline'}
                      onClick={() => onChallenge(f)}
                    >
                      Challenge
                    </button>
                    <button
                      type="button"
                      className="hud-btn hud-btn-subtle"
                      onClick={() => onRemove(f.other_id, 'unfriend')}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {outgoing && (
        <div className="account-overlay" role="dialog" aria-modal="true">
          <div className="account-card">
            <h2 className="account-title">Challenging {outgoing.to_nickname}…</h2>
            <p className="account-intro">
              Waiting for them to accept. Room code:{' '}
              <strong className="mp-code">{outgoing.room_code}</strong>
            </p>
            <div className="account-actions">
              <button
                type="button"
                className="end-game-btn end-game-btn--subtle"
                onClick={onCancelOutgoing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </details>
  );
}
