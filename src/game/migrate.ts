// One-shot localStorage migration: skyflag.* → 3phor.* keys.
//
// Why: during the rebrand we renamed every key. Existing users had their
// saved game, stats, theme, sound preference, etc. stored under the old
// prefix and would lose it on first load after deploy. This migrates
// each known key in place, then deletes the old key so the migration
// is idempotent (next load is a no-op).
//
// Called once at app boot from main.tsx. Synchronous so it completes
// before any reducer / component reads from storage.

const MIGRATIONS: Array<[oldKey: string, newKey: string]> = [
  ['skyflag.session.v1',         '3phor.session.v1'],
  ['skyflag.tutorial.v1.seen',   '3phor.tutorial.v1.seen'],
  ['skyflag.showThreats.v1',     '3phor.showThreats.v1'],
  ['skyflag.userId.v1',          '3phor.userId.v1'],
  ['skyflag.sound.muted',        '3phor.sound.muted'],
  ['skyflag.stats.v1',           '3phor.stats.v1'],
  ['skyflag.theme.v1',           '3phor.theme.v1'],
];

// Flag key so we only run the prefix-rewrite logic once. Stays under
// the new prefix so a future rename pass can re-migrate it cleanly.
const FLAG_KEY = '3phor.migrated.skyflag-prefix.v1';

export function migrateLocalStorage(): void {
  try {
    if (localStorage.getItem(FLAG_KEY)) return;

    for (const [oldKey, newKey] of MIGRATIONS) {
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue === null) continue;
      // Only set the new key if it isn't already populated — don't
      // clobber data the user has already written under the new name
      // (e.g. on a partial migration).
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldValue);
      }
      localStorage.removeItem(oldKey);
    }

    // Per-room rating-applied flags use a dynamic suffix
    // (`skyflag.rating-applied.{room.code}`). Walk all keys with that
    // prefix and rename to the 3phor.* equivalent.
    const OLD_PREFIX = 'skyflag.rating-applied.';
    const NEW_PREFIX = '3phor.rating-applied.';
    const dynamicKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(OLD_PREFIX)) dynamicKeys.push(k);
    }
    for (const oldKey of dynamicKeys) {
      const newKey = NEW_PREFIX + oldKey.slice(OLD_PREFIX.length);
      const v = localStorage.getItem(oldKey);
      if (v !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, v);
      }
      localStorage.removeItem(oldKey);
    }

    localStorage.setItem(FLAG_KEY, '1');
  } catch {
    // localStorage can fail in private browsing or when quota is hit.
    // Don't crash the app — losing the migration just means users start
    // fresh, which is the same outcome as a brand-new install.
  }
}
