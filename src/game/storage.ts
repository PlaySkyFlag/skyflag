import type { GameState, Player, RoomState } from './types';

const STORAGE_KEY = 'skyflag.session.v1';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Session = {
  game: GameState;
  aiPlayer: Player | null;
  // Optional so legacy saves without it still parse cleanly.
  room?: RoomState | null;
  difficulty?: Difficulty;
};

// Load a saved session if present and parseable. Returns null if there is
// nothing saved or the saved data fails a basic shape check (e.g., from an
// older schema, or corruption). Bumping the version suffix on STORAGE_KEY is
// the simple migration: old data becomes invisible.
export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const game = parsed.game;
    if (!game || !Array.isArray(game.onBoard) || !game.flags || !game.inHand || !game.captured) {
      return null;
    }
    // Sessions saved before the move-history feature shipped won't have a
    // history field; backfill it to an empty array so render code can rely
    // on it being present.
    if (!Array.isArray(game.history)) {
      game.history = [];
    }
    return parsed as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage can fail on quota or in private browsing — ignore so the
    // game keeps working in memory.
  }
}
