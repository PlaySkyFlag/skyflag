import { useState } from 'react';
import { createInitialGameState } from './game/constants';
import { getUserId } from './game/identity';
import { isMultiplayerAvailable, supabase } from './game/supabase';
import type { RoomState } from './game/types';

export type { RoomState };

// Reject room codes that look "expired" — the Supabase row exists but is
// older than this threshold. Stops a forgotten week-old code from being
// accidentally re-joined by someone with the same userId.
const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Props = {
  room: RoomState | null;
  onRoomEntered: (room: RoomState) => void;
  onLeave: () => void;
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

export default function Multiplayer({ room, onRoomEntered, onLeave }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isMultiplayerAvailable) {
    return (
      <details className="help">
        <summary className="help-summary">Multiplayer</summary>
        <div className="help-body">
          Online play requires Supabase credentials. Add{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_KEY</code> to{' '}
          <code>.env.local</code>.
        </div>
      </details>
    );
  }

  const inRoom = room !== null;

  const handleCreate = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const userId = getUserId();
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
      setError(err instanceof Error ? err.message : String(err));
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
      const userId = getUserId();
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="help" open={inRoom}>
      <summary className="help-summary">Multiplayer</summary>
      <div className="help-body">
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
              {' · '}You are <strong>{room.role === 'p1' ? 'Slate' : 'Ivory'}</strong>
              {' · '}
              {room.status === 'waiting'
                ? 'Waiting for opponent…'
                : 'Opponent connected — game in progress.'}
            </p>
            <button type="button" className="hud-btn hud-btn-subtle" onClick={onLeave}>
              Leave room
            </button>
          </>
        )}
        {error && <p className="mp-error">⚠ {error}</p>}
      </div>
    </details>
  );
}
