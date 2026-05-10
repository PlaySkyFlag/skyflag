// Singleton manager for the `lobby:global` Realtime channel.
//
// supabase-js dedupes channels by topic, so multiple components
// calling supabase.channel('lobby:global') would all get the same
// channel object — and the second/third caller's `.on(...)` would
// throw "cannot add callbacks after subscribe()" since the first
// caller has already called .subscribe().
//
// Three places want to interact with `lobby:global`:
//   * App.tsx — always-on presence listener for the header "online"
//     pill, regardless of which Sidebar tab is open
//   * Lobby.tsx — presence (full member list with nicknames) and
//     all the challenge / accept / decline broadcasts
//   * Friends.tsx — sends a challenge broadcast when the user hits
//     "Challenge" on a friend row
//
// This module owns the single subscription and exposes:
//   - ensureLobbyChannel(me) / teardownLobbyChannel()
//   - subscribePresence(cb) — full presence map updates
//   - subscribeBroadcast(event, cb) — challenge envelopes
//   - setAvailable(true/false) — track/untrack our own presence
//   - sendBroadcast(event, payload) — outgoing challenges, etc.
//
// All callbacks run idempotently — registering the same handler
// twice is fine; the unsubscribe function returned by each
// register call removes exactly that registration.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type LobbyMember = { user_id: string; nickname: string };
type PresenceListener = (members: Map<string, LobbyMember>) => void;
type BroadcastListener = (payload: unknown) => void;

const BROADCAST_EVENTS = [
  'challenge',
  'challenge-cancel',
  'challenge-decline',
  'challenge-accept',
] as const;

let channel: RealtimeChannel | null = null;
let me: LobbyMember | null = null;
let isTracking = false;

const presenceListeners = new Set<PresenceListener>();
const broadcastListeners = new Map<string, Set<BroadcastListener>>();
let lastPresence: Map<string, LobbyMember> = new Map();

function notifyPresence(): void {
  for (const cb of presenceListeners) {
    try {
      cb(lastPresence);
    } catch (err) {
      console.error('[lobbyChannel] presence listener threw', err);
    }
  }
}

function notifyBroadcast(event: string, payload: unknown): void {
  const set = broadcastListeners.get(event);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(payload);
    } catch (err) {
      console.error(`[lobbyChannel] ${event} listener threw`, err);
    }
  }
}

export function ensureLobbyChannel(user: LobbyMember): void {
  if (!supabase) return;
  // If we already have a channel for this user, no-op. If the
  // user identity changed (sign-out / sign-in), tear down first.
  if (channel) {
    if (me?.user_id === user.user_id) {
      // Update nickname in case the user just changed it.
      me = user;
      return;
    }
    teardownLobbyChannel();
  }
  me = user;
  const sb = supabase;
  const ch = sb.channel('lobby:global', {
    config: { presence: { key: user.user_id } },
  });

  ch.on('presence', { event: 'sync' }, () => {
    const raw = ch.presenceState() as Record<string, LobbyMember[]>;
    const map = new Map<string, LobbyMember>();
    for (const arr of Object.values(raw)) {
      for (const meta of arr) {
        if (!map.has(meta.user_id)) map.set(meta.user_id, meta);
      }
    }
    lastPresence = map;
    notifyPresence();
  });

  for (const evt of BROADCAST_EVENTS) {
    ch.on('broadcast', { event: evt }, ({ payload }) => {
      notifyBroadcast(evt, payload);
    });
  }

  ch.subscribe();
  channel = ch;
}

export function teardownLobbyChannel(): void {
  if (!channel || !supabase) {
    channel = null;
    me = null;
    isTracking = false;
    lastPresence = new Map();
    return;
  }
  supabase.removeChannel(channel);
  channel = null;
  me = null;
  isTracking = false;
  lastPresence = new Map();
  notifyPresence();
}

export function setAvailable(available: boolean): void {
  if (!channel || !me) return;
  if (available && !isTracking) {
    void channel.track(me);
    isTracking = true;
  } else if (!available && isTracking) {
    void channel.untrack();
    isTracking = false;
  }
}

export function sendBroadcast(event: string, payload: unknown): Promise<unknown> {
  if (!channel) return Promise.resolve();
  return channel.send({ type: 'broadcast', event, payload });
}

export function subscribePresence(cb: PresenceListener): () => void {
  presenceListeners.add(cb);
  // Replay last known state immediately so the new subscriber gets
  // a synchronous initial value.
  if (lastPresence.size > 0) cb(lastPresence);
  return () => {
    presenceListeners.delete(cb);
  };
}

export function subscribeBroadcast(
  event: string,
  cb: BroadcastListener,
): () => void {
  let set = broadcastListeners.get(event);
  if (!set) {
    set = new Set();
    broadcastListeners.set(event, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
  };
}

// Read-only accessor for the current presence map. Useful when
// rendering an initial value before the first listener fires.
export function currentPresence(): Map<string, LobbyMember> {
  return lastPresence;
}
