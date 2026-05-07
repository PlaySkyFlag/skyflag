// Anonymous user identity, persisted in localStorage. One opaque random ID
// per browser/device — no login required, but stable across sessions so a
// player rejoining a multiplayer room is recognised as the same human.

const STORAGE_KEY = 'skyflag.userId.v1';

function generateUserId(): string {
  // Browser-native, no crypto package needed. crypto.randomUUID is in all
  // modern browsers and iOS Safari 15.4+.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: 32 random hex chars. Not used on any browser SkyFlag targets,
  // but defensive against headless test environments.
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
}

export function getUserId(): string {
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
