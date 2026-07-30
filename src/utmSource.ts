// utmSource — remember which social platform sent a visitor, so the
// signup they make three pages later still attributes to it.
//
// Why this exists: routing here is a one-time check at mount with HARD
// navigation between pages (see main.tsx). A visitor who lands on
// playskyflag.com/?utm_source=reddit and clicks "Play" does a full page
// load to /play, and the query string is gone. Every capture form except
// /kickstarter therefore saw an empty `?utm_source` and wrote NULL — which
// is why the CRM's "signups by social source" panel has never populated
// even though the outbound links have been UTM-tagged since May.
//
// Fix: latch the value into sessionStorage on the first page load that
// carries it, then read from there at submit time. sessionStorage (not
// local) so the attribution window is the visit, not forever — a visitor
// who comes back cold next week shouldn't still be credited to Reddit.
// First tag wins: if someone arrives via Reddit and later clicks an
// X-tagged link mid-visit, the entry point is the honest attribution.

const KEY = 'thresan.utm-source';

// Same sanitiser the /kickstarter page has always used: lowercase, strip
// anything outside [a-z0-9_-], cap the length. The value goes into a
// Postgres column and a dashboard label, so never pass raw query input.
function clean(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  return v || null;
}

// Call once at boot, before any route renders. Idempotent and safe in
// private mode (storage throws) — attribution is best-effort and must
// never break a page load.
export function captureUtmSource(): void {
  try {
    const incoming = clean(
      new URLSearchParams(window.location.search).get('utm_source'),
    );
    if (incoming && !sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, incoming);
    }
  } catch {
    /* private mode or storage disabled — skip attribution */
  }
}

// Read at submit time. Falls back to the live query string so a direct
// hit on a tagged capture URL still attributes even if storage is
// unavailable (private mode, or the boot hook somehow didn't run).
export function getUtmSource(): string | null {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return stored;
  } catch {
    /* fall through to the query string */
  }
  return clean(new URLSearchParams(window.location.search).get('utm_source'));
}
