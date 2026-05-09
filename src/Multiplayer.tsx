import { useEffect, useState } from 'react';
import Lobby from './Lobby';
import { useAuthUser } from './game/auth';
import { createInitialGameState } from './game/constants';
import { getEffectiveUserId } from './game/identity';
import { loadProfile, type Profile } from './game/profile';
import {
  enableIosPush,
  enablePush,
  getPermissionState,
  getPushPlatform,
  isPushSupported,
  serializeSubscription,
} from './game/push';
import { isMultiplayerAvailable, supabase } from './game/supabase';
import type { RoomState } from './game/types';

export type { RoomState };

// Reject room codes that look "expired" — the Supabase row exists but is
// older than this threshold. Stops a forgotten week-old code from being
// accidentally re-joined by someone with the same userId.
const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Props = {
  room: RoomState | null;
  // When true, the Multiplayer panel is forced open even outside a room.
  // Used so picking "2P" mode auto-expands the panel and shows the lobby
  // / room-code controls (the user can either play hot-seat OR online).
  forceOpen?: boolean;
  onRoomEntered: (room: RoomState) => void;
  onLeave: () => void;
  // Forwards lobby presence sync up to App so the Friends panel can show
  // an online dot without needing its own subscription.
  onPresenceChange?: (ids: Set<string>) => void;
  // Render without the <details>/<summary> chrome — Sidebar uses this
  // when this panel is the active tab.
  inline?: boolean;
};

// Glyphs that read clearly on a phone — no I/O/0/1 ambiguity.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// Supabase errors aren't Error instances — they're plain objects with
// { code, message, details, hint }. Pull a useful string out of whatever
// shape we got so the UI never shows "[object Object]" again.
function formatError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  const e = err as { message?: string; details?: string; hint?: string; code?: string };
  const parts: string[] = [];
  if (e.message) parts.push(e.message);
  if (e.details && e.details !== e.message) parts.push(e.details);
  if (e.hint) parts.push(`(${e.hint})`);
  if (e.code) parts.push(`[${e.code}]`);
  return parts.length > 0 ? parts.join(' — ') : JSON.stringify(err);
}

// Inline control for the in-room "Enable turn notifications" flow.
// Dispatches by platform: Web Push (browser) or APNs via Capacitor (iOS).
// Both paths upsert into public.push_subscriptions keyed by
// (user_id, platform), so a user with both web and iOS gets pings on
// either device.
function NotificationsControl() {
  const { user: authUser } = useAuthUser();
  const platform = getPushPlatform();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | 'native'>(
    () => (platform === 'ios' ? 'native' : platform === 'web' ? getPermissionState() : 'unsupported'),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (platform === 'web') setPermission(getPermissionState());
  }, [platform]);

  if (platform === 'unsupported') {
    return <p className="mp-note">Notifications aren't supported on this device.</p>;
  }
  if (platform === 'web' && !isPushSupported()) {
    return <p className="mp-note">Browser notifications aren't supported on this device.</p>;
  }
  if (platform === 'web' && permission === 'granted') {
    return (
      <p className="mp-note">
        ✓ Notifications enabled. You'll be pinged when it's your turn.
      </p>
    );
  }
  if (platform === 'web' && permission === 'denied') {
    return (
      <p className="mp-note">
        Notifications were blocked. Allow them from your browser's site
        settings, then reload to try again.
      </p>
    );
  }

  return (
    <div className="mp-notify">
      <button
        type="button"
        className="hud-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          if (platform === 'ios') {
            const result = await enableIosPush();
            setBusy(false);
            if (!result.ok) {
              setMessage(
                result.reason === 'denied'
                  ? 'Permission denied. Enable Notifications for SkyFlag in iOS Settings.'
                  : `Couldn't enable: ${result.message ?? result.reason}`,
              );
              return;
            }
            if (authUser && supabase) {
              const { error: saveErr } = await supabase
                .from('push_subscriptions')
                .upsert(
                  {
                    user_id: authUser.id,
                    platform: 'ios',
                    apns_token: result.token,
                    user_agent: navigator.userAgent,
                  },
                  { onConflict: 'user_id,platform' },
                );
              setMessage(
                saveErr
                  ? `Subscribed locally, but couldn't save: ${saveErr.message}`
                  : "✓ Subscribed. You'll be pinged when it's your turn.",
              );
            } else {
              setMessage('Sign in to enable server-side delivery.');
            }
            return;
          }

          // Web platform path.
          const result = await enablePush();
          setBusy(false);
          setPermission(getPermissionState());
          if (result.ok) {
            if (authUser && supabase) {
              const row = serializeSubscription(result.subscription);
              const { error: saveErr } = await supabase
                .from('push_subscriptions')
                .upsert(
                  {
                    user_id: authUser.id,
                    platform: 'web',
                    ...row,
                    user_agent: navigator.userAgent,
                  },
                  { onConflict: 'user_id,platform' },
                );
              if (saveErr) {
                setMessage(`Subscribed locally, but couldn't save: ${saveErr.message}`);
              } else {
                setMessage("✓ Subscribed. You'll be pinged when it's your turn.");
              }
            } else {
              setMessage('Subscribed locally. Sign in to enable server-side delivery.');
            }
          } else if (result.reason === 'denied') {
            setMessage('Permission denied.');
          } else if (result.reason === 'no-vapid') {
            setMessage('Push key not configured — needs VITE_VAPID_PUBLIC_KEY.');
          } else {
            setMessage(`Couldn't enable: ${result.message ?? result.reason}`);
          }
        }}
      >
        {busy ? 'Requesting…' : 'Enable turn notifications'}
      </button>
      {message && <p className="mp-note">{message}</p>}
    </div>
  );
}

export default function Multiplayer({ room, forceOpen = false, onRoomEntered, onLeave, onPresenceChange, inline = false }: Props) {
  const { user: authUser } = useAuthUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a copy of the signed-in user's profile so Lobby can show their
  // nickname when broadcasting presence. Refreshed when the user changes.
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    loadProfile(authUser.id).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  if (!isMultiplayerAvailable) {
    const unavailableBody = (
      <div className="help-body">
        Online play requires Supabase credentials. Add{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_KEY</code> to{' '}
        <code>.env.local</code>.
      </div>
    );
    if (inline) return unavailableBody;
    return (
      <details className="help">
        <summary className="help-summary">Multiplayer</summary>
        {unavailableBody}
      </details>
    );
  }

  const inRoom = room !== null;

  const handleCreate = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const userId = getEffectiveUserId(authUser?.id ?? null);
      // Retry on (rare) room-code collisions — unique constraint on the table.
      for (let attempt = 0; attempt < 5; attempt++) {
        const tryCode = generateRoomCode();
        const { data, error: insertErr } = await supabase
          .from('games')
          .insert({
            room_code: tryCode,
            state: createInitialGameState(),
            p1_id: userId,
            p2_id: null,
          })
          .select()
          .single();
        if (!insertErr) {
          onRoomEntered({ code: data.room_code, role: 'p1', status: 'waiting' });
          return;
        }
        // 23505 = unique_violation in Postgres. Anything else, surface.
        if (insertErr.code !== '23505') throw insertErr;
      }
      throw new Error('Could not allocate a room code after 5 attempts');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!supabase) return;
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const userId = getEffectiveUserId(authUser?.id ?? null);
      const { data: existing, error: fetchErr } = await supabase
        .from('games')
        .select('*')
        .eq('room_code', cleaned)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!existing) {
        throw new Error(`No room ${cleaned} — check the code`);
      }
      // Reject rooms older than the max age — abandoned rows shouldn't be
      // reusable. created_at is set by the table default on insert.
      if (existing.created_at) {
        const ageMs = Date.now() - new Date(existing.created_at).getTime();
        if (ageMs > ROOM_MAX_AGE_MS) {
          throw new Error(`Room ${cleaned} expired — ask for a fresh code`);
        }
      }
      // Reconnecting as P1 (same device, same userId).
      if (existing.p1_id === userId) {
        onRoomEntered({
          code: cleaned,
          role: 'p1',
          status: existing.p2_id ? 'playing' : 'waiting',
        });
        return;
      }
      // Reconnecting as P2.
      if (existing.p2_id === userId) {
        onRoomEntered({ code: cleaned, role: 'p2', status: 'playing' });
        return;
      }
      // Someone else already filled the second seat.
      if (existing.p2_id) {
        throw new Error(`Room ${cleaned} is full`);
      }
      // Take the open second seat.
      const { error: updateErr } = await supabase
        .from('games')
        .update({ p2_id: userId })
        .eq('room_code', cleaned);
      if (updateErr) throw updateErr;
      onRoomEntered({ code: cleaned, role: 'p2', status: 'playing' });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <div className="help-body">
        {!inRoom && authUser && (
          <Lobby
            user={authUser}
            profile={profile}
            inRoom={inRoom}
            onEnterRoom={onRoomEntered}
            onPresenceChange={onPresenceChange}
          />
        )}
        {!inRoom && !authUser && (
          <p className="lobby-hint">
            Sign in (button at the top of the page) to see other players online
            and challenge them. You can still play by code below.
          </p>
        )}
        {!inRoom && (
          <>
            <p>
              Play online against another human. Create a room and share the
              4-letter code, or join with one you've been given.
            </p>
            <div className="mp-actions">
              <button type="button" className="hud-btn" disabled={busy} onClick={handleCreate}>
                Create room
              </button>
              <span className="mp-or">or</span>
              <input
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="CODE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                maxLength={4}
                className="mp-input"
              />
              <button
                type="button"
                className="hud-btn"
                disabled={busy || code.length !== 4}
                onClick={handleJoin}
              >
                Join
              </button>
            </div>
          </>
        )}
        {inRoom && room && (
          <>
            <p>
              Room <strong className="mp-code">{room.code}</strong>
              {' · '}You are <strong>{room.role === 'p1' ? 'Grey Ravens' : 'White Stags'}</strong>
              {' · '}
              {room.status === 'waiting'
                ? 'Waiting for opponent…'
                : 'Opponent connected — game in progress.'}
            </p>
            <NotificationsControl />
            <button type="button" className="hud-btn hud-btn-subtle" onClick={onLeave}>
              Leave room
            </button>
          </>
        )}
        {error && <p className="mp-error">⚠ {error}</p>}
      </div>
  );
  if (inline) return body;
  return (
    <details className="help" open={inRoom || forceOpen}>
      <summary className="help-summary">Multiplayer</summary>
      {body}
    </details>
  );
}
