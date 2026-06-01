#!/usr/bin/env node
// Route-integrity smoke test — the QAQC guard for the class of bug that
// took the launch-email funnel down on 2026-06-01.
//
// What broke: every path was routed through the /api/seo edge function,
// whose self-fetch of index.html is flaky on Vercel. On failure it 302'd
// to /index.html, stripping the path, so the SPA booted on the wrong path
// and rendered the landing page. Deep links (/kickstarter, /play, ...)
// silently bounced to the top of the homepage — intermittently, which is
// why a one-shot manual click could look fine and still be broken.
//
// THE INVARIANT this enforces, as a real browser sees it:
//   every marketing/funnel route must return 200 with the SPA shell AT
//   ITS OWN URL — never a 3xx that changes the path.
// Each route is probed several times because the failure was intermittent
// (edge-cache MISS hit the bad path; HIT masked it). One bad response in
// the batch fails the run.
//
// Usage:
//   node scripts/smoke-routes.mjs                 # checks https://playskyflag.com
//   node scripts/smoke-routes.mjs https://host    # checks another origin (preview deploy)
//   TRIES=8 node scripts/smoke-routes.mjs         # more probes per route
//
// Exit 0 = all routes healthy. Exit 1 = at least one route regressed.

const BASE = (process.argv[2] || 'https://playskyflag.com').replace(/\/$/, '');
const TRIES = Number(process.env.TRIES || 5);

// A realistic browser UA so we exercise the human path (tier 2 in
// vercel.json), which is what actual visitors clicking the button get.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// The routes that matter for the campaign + the routes that share the
// rewrite that broke. The email funnel (/kickstarter) is the headline.
const ROUTES = [
  '/',
  '/kickstarter',
  '/play',
  '/origins',
  '/story',
  '/press',
  '/world',
];

async function probe(path) {
  const url = `${BASE}${path}`;
  // redirect: 'manual' so a 3xx is observed, not silently followed.
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
  });
  const status = res.status;
  const location = res.headers.get('location') || '';
  // A 3xx is the failure signature. So is a 200 that somehow isn't the
  // SPA shell. We read the body only for 2xx to confirm the shell.
  if (status >= 300 && status < 400) {
    return { ok: false, status, detail: `redirect → ${location}` };
  }
  if (status !== 200) {
    return { ok: false, status, detail: `unexpected status` };
  }
  const html = await res.text();
  if (!html.includes('id="root"')) {
    return { ok: false, status, detail: 'served 200 but not the SPA shell' };
  }
  return { ok: true, status, detail: 'SPA shell at own URL' };
}

async function checkRoute(path) {
  const results = [];
  for (let i = 0; i < TRIES; i++) {
    try {
      results.push(await probe(path));
    } catch (err) {
      results.push({ ok: false, status: 0, detail: `fetch error: ${err.message}` });
    }
  }
  const bad = results.filter((r) => !r.ok);
  const healthy = bad.length === 0;
  const summary = healthy
    ? results[0].detail
    : `${bad.length}/${TRIES} bad — ${bad[0].status} ${bad[0].detail}`;
  return { path, healthy, summary };
}

console.log(`Route-integrity smoke test → ${BASE}  (${TRIES} probes/route, browser UA)\n`);

const checks = await Promise.all(ROUTES.map(checkRoute));
let failed = 0;
for (const c of checks) {
  const mark = c.healthy ? '✓' : '✗';
  if (!c.healthy) failed++;
  console.log(`  ${mark} ${c.path.padEnd(14)} ${c.summary}`);
}

// ── Capture health (optional) ────────────────────────────────────────
// The form's DB write broke mid-campaign once (anon INSERT rejected by
// RLS) with no alert. If SMOKE_SUPABASE_URL + SMOKE_ANON_KEY are set, do
// a real anon insert through the public path; if SMOKE_SERVICE_KEY is set
// too, delete the canary afterward. Skipped (not failed) when unset, so
// the route monitor still runs anywhere.
async function checkCapture() {
  const url = process.env.SMOKE_SUPABASE_URL;
  const anon = process.env.SMOKE_ANON_KEY;
  const svc = process.env.SMOKE_SERVICE_KEY;
  if (!url || !anon) return { skipped: true };
  const email = `smoke-canary-${Date.now()}@playskyflag.com`;
  const res = await fetch(`${url}/rest/v1/thresan_waitlist`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ email, source: 'healthcheck', consent: true }),
  });
  const ok = res.status === 201;
  let cleaned = 'left (no service key)';
  if (ok && svc) {
    const row = (await res.json())[0];
    await fetch(`${url}/rest/v1/thresan_waitlist?id=eq.${row.id}`, {
      method: 'DELETE', headers: { apikey: svc, Authorization: `Bearer ${svc}` },
    });
    cleaned = 'canary deleted';
  }
  return { skipped: false, ok, status: res.status, detail: ok ? `anon insert 201 (${cleaned})` : `anon insert ${res.status} — CAPTURE DOWN (form cannot save emails)` };
}

const cap = await checkCapture();
if (!cap.skipped) {
  console.log(`  ${cap.ok ? '✓' : '✗'} capture       ${cap.detail}`);
  if (!cap.ok) failed++;
} else {
  console.log('  · capture       (skipped — set SMOKE_SUPABASE_URL/SMOKE_ANON_KEY to enable)');
}

console.log('');
if (failed) {
  console.error(
    `FAIL: ${failed} check(s) regressed — deep links redirecting away from ` +
      `their own URL and/or the signup form cannot save. The funnel is broken.`,
  );
  process.exit(1);
} else {
  console.log(`PASS: all ${checks.length} routes serve the SPA at their own URL.`);
}
