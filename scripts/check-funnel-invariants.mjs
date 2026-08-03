#!/usr/bin/env node
// QAQC: funnel invariants — guards the marketing/attribution layer the
// way check-render-invariants.mjs guards the board.
//
// Every invariant here corresponds to a bug that ALREADY HAPPENED or a
// footgun that was one commit away. None of them are hypothetical.
//
// Dependency-free on purpose: the route-smoke workflow runs these
// straight after `actions/checkout` with no `npm ci`, so this file may
// only use the Node stdlib.
//
// Run: `npm run check:funnel` (also runs in the route-smoke workflow).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const fail = [];
const notices = [];
const srcFiles = readdirSync('src')
  .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
  .map((f) => join('src', f));

const read = (p) => readFileSync(p, 'utf8');

// Line-based scans skip comments. Several of these invariants are
// documented in prose right next to the code that enforces them (e.g.
// campaign.ts explains why NEXT_PUBLIC_* is wrong), and a guard that
// flags its own rationale is a guard people switch off.
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

function scanLines(file, fn) {
  read(file)
    .split('\n')
    .forEach((line, i) => {
      if (!isComment(line)) fn(line, i + 1);
    });
}

// ── Invariant 1: piece-count copy ────────────────────────────────────
// Rulebook v22 §3 "The Four Pieces": a player commands FOUR pieces; the
// Soldier promotes into a second Captain, which is the fifth piece but
// is EARNED, never dealt. "Five pieces a side" is therefore false.
//
// This regressed once already: it was standardised to "five" in May
// 2026, corrected in July, and had been reintroduced by the daily post
// generator in between. It lives in templates, so a human grep is not a
// durable fix. Roster/type framing ("five piece types", "five-piece
// roster") is legitimate and deliberately NOT matched here.
const BANNED_COPY = [
  /five\s+pieces?\s+(a|per)\s+side/i,
  /\b5\s+pieces?\s+(a|per)\s+side/i,
  /commands?\s+five\s+pieces/i,
  /starts?\s+with\s+five\s+pieces/i,
];
for (const file of [...srcFiles, 'README.md']) {
  scanLines(file, (line, n) => {
    for (const re of BANNED_COPY) {
      if (re.test(line)) {
        fail.push(
          `${file}:${n} — piece-count copy regression: "${line.trim().slice(0, 90)}"\n` +
            `    A side commands FOUR pieces (v22 §3). "five piece types" is fine; ` +
            `"five pieces a side" is not.`,
        );
      }
    }
  });
}

// ── Invariant 2: every waitlist capture records utm_source ────────────
// The root cause of the attribution blackout: of six capture points only
// /kickstarter read utm_source, so the one channel that ever converted
// (post-game) wrote NULL every time. Routing here is hard navigation, so
// the tag is gone from location.search by the time a form submits — the
// value MUST come from the src/utmSource.ts latch.
//
// This catches a NEW capture point added without attribution.
const INSERT_RE = /\.from\((['"])thresan_waitlist\1\)\s*\r?\n?\s*\.insert\(\{/g;
for (const file of srcFiles) {
  const text = read(file);
  for (const m of text.matchAll(INSERT_RE)) {
    // Read the object literal that follows, to its closing brace.
    const start = m.index + m[0].length;
    let depth = 1;
    let end = start;
    while (end < text.length && depth > 0) {
      const c = text[end];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      end++;
    }
    const body = text.slice(start, end);
    if (!/\butm_source\s*:/.test(body)) {
      const line = text.slice(0, m.index).split('\n').length;
      fail.push(
        `${file}:${line} — thresan_waitlist insert has no utm_source.\n` +
          `    Add \`utm_source: getUtmSource(),\` (import from './utmSource'), ` +
          `or this capture point silently loses every social attribution.`,
      );
    }
  }
}

// ── Invariant 3: Kickstarter ref tags are KS-MINTED, not readable ─────
// Kickstarter ignores the label you type and mints its own opaque
// alphanumeric tag; that minted value is the ONLY thing its analytics
// count. So a well-meaning cleanup that rewrites 'jmx8kf' to the
// readable 'game_postgame' keeps every link working and silently stops
// every click being attributed — invisible until you check the KS
// dashboard weeks later and find zeroes.
//
// The old URL-safety check (/^[a-z0-9_-]{1,40}$/) happily PASSED
// 'game_postgame', so it could not catch that. Minted tags contain no
// underscores or hyphens, which is what distinguishes them.
{
  const campaign = read('src/campaign.ts');
  const block = campaign.match(
    /KICKSTARTER_REF_TAGS[^=]*=\s*\{([\s\S]*?)\n\};/,
  );
  if (!block) {
    fail.push(
      'src/campaign.ts — KICKSTARTER_REF_TAGS block not found; the ref-tag ' +
        'guard can no longer verify it. Update this check if it was renamed.',
    );
  } else {
    const mapped = new Set();
    for (const [, key, val] of block[1].matchAll(
      /^\s*'?([a-z-]+)'?\s*:\s*'([^']*)'/gm,
    )) {
      mapped.add(key);
      if (!/^[a-z0-9]{4,12}$/.test(val)) {
        fail.push(
          `src/campaign.ts — ref tag ${key}='${val}' is not a Kickstarter-minted tag.\n` +
            `    Expected an opaque alphanumeric value like 'jmx8kf' (/^[a-z0-9]{4,12}$/).\n` +
            `    Underscores/hyphens mean someone substituted the human LABEL for the\n` +
            `    minted tag — links keep working, attribution silently stops. Copy the\n` +
            `    value from the KS dashboard's "Custom tag" column, not the label column.`,
        );
      }
    }

    // Non-fatal: a declared surface with no tag emits an untagged (but
    // working) link, so this reports rather than blocks — a new surface
    // legitimately has no tag until someone generates one on Kickstarter.
    const union = campaign.match(/export type CampaignSurface\s*=([\s\S]*?);/);
    if (union) {
      const surfaces = [...union[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
      const missing = surfaces.filter((s) => !mapped.has(s));
      if (missing.length) {
        notices.push(
          `${missing.length} campaign surface(s) have no Kickstarter ref tag and will ` +
            `emit untagged links: ${missing.join(', ')}.\n` +
            `    Generate them at KS → Promotion → Custom referral tags, then map the ` +
            `minted value in src/campaign.ts.`,
        );
      }
    }
  }
}

// ── Invariant 4: no Next.js env access in a Vite app ─────────────────
// The 2026-07-30 strategy doc specified
// `process.env.NEXT_PUBLIC_CAMPAIGN_PHASE`. This is Vite: that is
// `undefined` in the browser bundle and fails SILENTLY — the campaign
// phase would just always read as the fallback. Vite uses
// `import.meta.env.VITE_*`, inlined at build time.
for (const file of srcFiles) {
  scanLines(file, (line, n) => {
    if (/process\.env\.NEXT_PUBLIC_/.test(line)) {
      fail.push(
        `${file}:${n} — process.env.NEXT_PUBLIC_* in a Vite app.\n` +
          `    This is undefined in the browser and fails silently. ` +
          `Use import.meta.env.VITE_*.`,
      );
    }
  });
}

// ── Invariant 5: one launch date, and it is Oct 27 2026 ──────────────
// There was a real Oct 20 vs Oct 27 split across site copy and the CRM.
// The countdown, the store CTA and every phase boundary now derive from
// campaign.ts, so a second hardcoded launch date means something has
// drifted back out of the shared module.
{
  const campaign = read('src/campaign.ts');
  if (!/LAUNCH_TS\s*=\s*Date\.parse\('2026-10-27T16:00:00Z'\)/.test(campaign)) {
    fail.push(
      "src/campaign.ts — LAUNCH_TS is not 2026-10-27T16:00:00Z. That date is " +
        'canonical (resolved 2026-06-04); change it only deliberately.',
    );
  }
  for (const file of srcFiles.filter((f) => f !== 'src/campaign.ts')) {
    scanLines(file, (line, n) => {
      if (/2026-10-2\d|new Date\('2026-10-/.test(line)) {
        fail.push(
          `${file}:${n} — hardcoded launch date outside campaign.ts: ` +
            `"${line.trim().slice(0, 70)}"\n    Import LAUNCH_TS from './campaign' instead.`,
        );
      }
    });
  }
  // The Oct 20 ghost.
  for (const file of [...srcFiles, 'README.md']) {
    scanLines(file, (line, n) => {
      if (/October\s+20\b|Oct\.?\s+20\b|2026-10-20/.test(line)) {
        fail.push(
          `${file}:${n} — launch date says October 20. Canonical is ` +
            `October 27, 2026: "${line.trim().slice(0, 70)}"`,
        );
      }
    });
  }
}

// ── Report ───────────────────────────────────────────────────────────
for (const n of notices) console.warn('  ! ' + n + '\n');
if (fail.length) {
  console.error('✗ funnel invariants FAILED\n');
  for (const f of fail) console.error('  • ' + f + '\n');
  process.exit(1);
}
console.log(
  '✓ funnel invariants OK — piece-count copy clean, every thresan_waitlist ' +
    'insert records utm_source, ref tags URL-safe, no Next-style env access, ' +
    'single canonical launch date.',
);
