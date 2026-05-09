// Friends panel — accepted friends, pending requests in/out, and an
// "add by nickname" form. Online status is read from the lobby presence
// state owned by the Lobby component (passed down via `onlineIds`),
// because Supabase realtime returns the same channel instance per topic
// and we can't add a second presence subscriber after Lobby subscribes.
//
// To send a challenge we look up the existing lobby channel and call
// .send() on it — broadcasts work fine post-subscribe. The recipient's
// existing Lobby challenge listener handles the Accept/Decline modal,
// and Lobby's challenge-accept listener drives the room transition for
// both sides, so Friends doesn't need to track outgoing state itself.

import { useCallback, useEffect, useState } from 'react';
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
  onlineIds: Set<string>;
};

export default function Friends({ user, profile, inRoom, onlineIds }: Props) {
  const [entries, setEntries] = useState<FriendEntry[]>([]);
  const [addInput, setAddInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
      // Reuse the lobby channel that Lobby has already subscribed to —
      // .send() works post-subscribe, and Lobby's existing listeners on
      // both sides will handle the accept/decline + room transition.
      await supabase
        .channel(LOBBY_CHANNEL)
        .send({
          type: 'broadcast',
          event: 'challenge',
          payload: {
            from_user_id: user.id,
            from_nickname: profile.nickname,
            to_user_id: other.other_id,
            room_code: code,
          },
        });
      setInfo(`Challenge sent to ${other.other_nickname}.`);
      setTimeout(() => setInfo(null), 4000);
    },
    [user, profile, inRoom],
  );

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
                      disabled={!online || inRoom || busy}
                      title={online ? 'Send a challenge' : 'Friend is offline (toggle "Looking for a game" on their end)'}
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
    </details>
  );
}
