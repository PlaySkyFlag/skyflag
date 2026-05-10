// Anonymous user identity, persisted in localStorage. One opaque random ID
// per browser/device — no login required, but stable across sessions so a
// player rejoining a multiplayer room is recognised as the same human.

const STORAGE_KEY = '3phor.userId.v1';

function generateUserId(): string {
  // Browser-native, no crypto package needed. crypto.randomUUID is in all
  // modern browsers and iOS Safari 15.4+.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: 32 random hex chars. Not used on any browser 3phor targets,
  // but defensive against headless test environments.
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
}

// Returns the canonical "who am I" identifier for multiplayer purposes.
// When an authenticated user is signed in, prefer their auth uid (stable
// across devices, ties to a profile). Otherwise fall back to the anonymous
// device-local id so unsigned players can still create/join rooms.
export function getEffectiveUserId(authUserId: string | null): string {
  return authUserId ?? getUserId();
}

export function getUserId(): string {
  // Dev/test override: ?u=<anything> in the URL forces that value as the
  // userId for this tab without touching localStorage. Lets two browser
  // tabs in the same profile pretend to be different players (?u=alice
  // vs ?u=bob) for solo multiplayer testing.
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const override = params.get('u');
      if (override) return `override:${override}`;
    } catch {
      // URL parsing shouldn't fail, but fall through if it does.
    }
  }

  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // localStorage may throw in private mode; fall through to fresh ID.
  }
  const fresh = generateUserId();
  try {
    localStorage.setItem(STORAGE_KEY, fresh);
  } catch {
    // Same — failure to persist is OK, the ID just isn't stable.
  }
  return fresh;
}
