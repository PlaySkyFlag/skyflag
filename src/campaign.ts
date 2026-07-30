// campaign — one source of truth for what phase the Kickstarter is in,
// and what every campaign-facing CTA should therefore say and point at.
//
// Replaces the phase logic that was scattered across surfaces: the
// LAUNCH_TS countdown in Kickstarter.tsx and the hand-flipped
// KICKSTARTER_URL = '' constant in ThresanStore.tsx. Those disagreed by
// construction — one was date-driven, the other manual.
//
// DERIVED FROM THE DATE, NOT AN ENV VAR. The strategy doc proposed a
// Vercel env var flipped by hand on launch morning. Two problems:
//   1. This is Vite, not Next.js. `process.env.NEXT_PUBLIC_*` does not
//      exist in the browser bundle; Vite exposes `import.meta.env.VITE_*`
//      and inlines it at BUILD time. So an env flip needs a redeploy
//      anyway — it is not a live switch.
//   2. It requires a solo operator to remember, at 9am on launch day,
//      while running a live campaign. The launch date is already known.
// So the phase is computed from the clock and flips itself, with no
// deploy. VITE_CAMPAIGN_PHASE stays available as an override purely so
// LIVE/ENDED can be exercised in a preview build before October.

import { KICKSTARTER_PRELAUNCH_URL } from './kickstarterLink';

export type CampaignPhase = 'PRELAUNCH' | 'LIVE' | 'ENDED' | 'EVERGREEN';

// Launch 2026-10-27 ~09:00 PT; campaign runs 28 days and closes
// 2026-11-27. Kept in UTC so the boundary is unambiguous.
export const LAUNCH_TS = Date.parse('2026-10-27T16:00:00Z');
export const END_TS = Date.parse('2026-11-27T16:00:00Z');

// The live-campaign URL is NOT the pre-launch URL — Kickstarter issues a
// different one when the project goes live. Until that is known this
// stays empty and every LIVE-phase link falls back to the pre-launch URL
// rather than rendering a dead href. Fill it in on launch day.
export const KICKSTARTER_LIVE_URL = '';

// Late-pledge destination (BackerKit, the store, or nothing). Undecided,
// so ENDED currently falls back to the store.
export const LATE_PLEDGE_URL = '';

const STORE_URL = 'https://thresan.store';

function envOverride(): CampaignPhase | null {
  const raw = import.meta.env.VITE_CAMPAIGN_PHASE;
  if (raw === 'PRELAUNCH' || raw === 'LIVE' || raw === 'ENDED' || raw === 'EVERGREEN') {
    return raw;
  }
  return null;
}

export function phaseForDate(now: number = Date.now()): CampaignPhase {
  if (now < LAUNCH_TS) return 'PRELAUNCH';
  if (now < END_TS) return 'LIVE';
  return 'ENDED';
}

// The phase every surface should read. An override wins, but disagreeing
// with the calendar logs a warning — the "notice when the operator
// forgets" check the strategy doc asked for, pointed at the failure mode
// that can actually happen here (a stale override shipped to prod).
export function currentPhase(now: number = Date.now()): CampaignPhase {
  const override = envOverride();
  const derived = phaseForDate(now);
  if (override && override !== derived) {
    console.warn(
      `[campaign] VITE_CAMPAIGN_PHASE=${override} disagrees with the date ` +
        `(${derived}). Fine in a preview build; wrong in production.`,
    );
    return override;
  }
  return derived;
}

// ─── Kickstarter referral tags ──────────────────────────────────────
//
// Kickstarter's dashboard reads `?ref=`, NOT `utm_source` — UTM params
// are ignored there and don't survive the hop. So outbound "Follow" /
// "Back it" links carry a ref tag naming the surface they came from.
//
// ⚠️ EMPTY ON PURPOSE. Kickstarter only counts ref values that already
// exist in the dashboard's referral-tag list (the `channel_purpose`
// taxonomy, e.g. `network_personal`). A tag invented here would produce
// traffic KS silently does not attribute — worse than no tag, because it
// looks instrumented. Fill these in from the dashboard, then every
// surface starts attributing with no further code change.
//
// Unmapped surface => no `ref` param at all. That is the documented
// fallback: an untagged-but-working link.
export type CampaignSurface =
  | 'postgame'
  | 'kickstarter-page'
  | 'store'
  | 'studio'
  | 'volume-zero'
  | 'io'
  | 'umbrella'
  | 'inline';

export const KICKSTARTER_REF_TAGS: Partial<Record<CampaignSurface, string>> = {
  // postgame:          '',
  // 'kickstarter-page':'',
  // store:             '',
  // studio:            '',
  // 'volume-zero':     '',
  // io:                '',
  // umbrella:          '',
  // inline:            '',
};

// Only [a-z0-9_-], so nothing we emit can break the outbound URL.
const SAFE_REF = /^[a-z0-9_-]{1,40}$/;

// If the visitor arrived on our site already carrying a ?ref=, that is
// the truthful attribution and it wins over our per-surface tag.
function inboundRef(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('ref');
    const v = (raw ?? '').toLowerCase();
    return SAFE_REF.test(v) ? v : null;
  } catch {
    return null;
  }
}

function withRef(url: string, surface?: CampaignSurface): string {
  const tag = inboundRef() ?? (surface ? KICKSTARTER_REF_TAGS[surface] : undefined);
  if (!tag || !SAFE_REF.test(tag)) return url;
  // Never double-append, and never clobber an existing ref on the target.
  if (/[?&]ref=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}ref=${tag}`;
}

// Where a "the Kickstarter" link should go in a given phase. Never
// returns an empty string. Pass the surface to attach its ref tag.
export function campaignUrl(
  phase: CampaignPhase = currentPhase(),
  surface?: CampaignSurface,
): string {
  return withRef(campaignUrlBase(phase), surface);
}

function campaignUrlBase(phase: CampaignPhase): string {
  switch (phase) {
    case 'LIVE':
      return KICKSTARTER_LIVE_URL || KICKSTARTER_PRELAUNCH_URL;
    case 'ENDED':
      return LATE_PLEDGE_URL || STORE_URL;
    case 'EVERGREEN':
      return STORE_URL;
    case 'PRELAUNCH':
    default:
      return KICKSTARTER_PRELAUNCH_URL;
  }
}

// Primary CTA label per phase. House style: no em dashes.
export function campaignCta(phase: CampaignPhase = currentPhase()): string {
  switch (phase) {
    case 'LIVE':
      return 'Back it on Kickstarter →';
    case 'ENDED':
      return LATE_PLEDGE_URL ? 'Late pledge →' : 'See the physical edition →';
    case 'EVERGREEN':
      return 'Play free →';
    case 'PRELAUNCH':
    default:
      return 'Follow on Kickstarter →';
  }
}

// Global banner copy, or null when there is nothing to say.
export function campaignBanner(
  phase: CampaignPhase = currentPhase(),
  surface?: CampaignSurface,
): { text: string; cta: string; href: string } | null {
  switch (phase) {
    case 'PRELAUNCH':
      return {
        text: 'Thresan: Skyflag launches on Kickstarter October 27.',
        cta: 'Follow the campaign',
        href: campaignUrl(phase, surface),
      };
    case 'LIVE':
      return {
        text: 'Thresan: Skyflag is live on Kickstarter. Back the physical edition before November 27.',
        cta: 'Back it',
        href: campaignUrl(phase, surface),
      };
    case 'ENDED':
      return {
        text: 'The Kickstarter has closed.',
        cta: LATE_PLEDGE_URL ? 'Late pledges are open' : 'See the physical edition',
        href: campaignUrl(phase, surface),
      };
    default:
      return null;
  }
}
