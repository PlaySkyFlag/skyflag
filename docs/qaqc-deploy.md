# QAQC: deploy & route-integrity cycle

Added after the 2026-06-01 funnel outage. This is the standing process for
shipping anything that touches routing, the SEO edge function, `vercel.json`,
or the conversion funnel.

## What went wrong (so we don't repeat it)

Every path was routed through the `/api/seo` edge function, which fetched
`index.html` from itself, injected per-page social meta, and returned it.
**That self-fetch is flaky on Vercel.** On failure the fallback did
`Response.redirect('/index.html', 302)` — which strips the path. The SPA then
booted on `/index.html`, matched no route, and rendered the landing page. So
**every deep link** (`/kickstarter`, `/play`, `/origins`, …) intermittently
bounced visitors to the top of the homepage. The launch-email button looked
broken; in fact the whole deep-link layer was.

Why it slipped through:

1. **Production-only failure.** A local `npm run build` / `vite preview` can't
   reproduce it — it lives in the Vercel edge runtime. We had no check that
   exercised the *deployed* site.
2. **Intermittent.** A single manual click hits the edge cache and often looks
   fine. The failure only shows on a cache MISS during a flaky moment.
3. **Silent.** A 302 to a real page (the homepage) is not an error — nothing
   logged, nothing alerted. It just quietly leaked every lead.

## The architecture rule

- **Humans never depend on the SEO edge function.** `vercel.json` serves real
  browsers the static SPA shell (`/index.html`) at their own URL; the SPA
  routes client-side off `window.location.pathname`. Only known crawlers
  (UA-matched) go through `/api/seo` for per-surface meta.
- **The edge function must never emit a 3xx that changes the path.** Its
  failure path serves a 200 meta-only document (`metaOnlyDocument`), not a
  redirect. A path-stripping redirect is the exact bug — see the comment in
  `api/seo.ts`.

## The cycle — run this on every routing/funnel/SEO change

1. **Before merging:** `npm run build` (must pass) and eyeball the diff to
   `vercel.json` / `api/seo.ts` against the architecture rule above.
2. **After deploy (automatic):** the `route-smoke` GitHub Action waits ~2 min
   for Vercel, then runs `scripts/smoke-routes.mjs` against production. It
   probes every funnel/marketing route 8× with a real browser UA and fails if
   any route returns a 3xx or doesn't serve the SPA shell at its own URL.
3. **Continuous:** the same Action runs every 15 min as a synthetic monitor,
   so an intermittent or platform-side regression surfaces within minutes
   instead of at the worst possible time.
4. **On demand / before a campaign push:** `npm run smoke` (or
   `TRIES=20 npm run smoke`) locally. Run it right after pointing ads/email at
   the site, and again an hour in.

## The invariant, stated once

> Every marketing/funnel route must return **200 with the SPA shell at its own
> URL** — never a 3xx that changes the path.

If `npm run smoke` is green, the funnel can capture email. If it's red, it
can't — treat it as a P0.
