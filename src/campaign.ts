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
//      anyway, so it is not a live switch.
//   2. It requires a solo operator to remember, on the morning of launch,
//      while running a live campaign.
// So once a launch date is set, the phase is computed from the clock and
// flips itself, with no deploy. VITE_CAMPAIGN_PHASE stays available as an
// override purely so LIVE/ENDED can be exercised in a preview build.
//
// LAUNCH DATE: 27 October 2027, about 09:00 PT (owner decision, 8 Nov
// 2026). Copy reads the date from LAUNCH_LABEL. If the date moves: change
// LAUNCH_TS, END_TS and LAUNCH_LABEL together, and update
// scripts/check-funnel-invariants.mjs invariant 5 to match. Setting
// LAUNCH_TS to null holds the site in PRELAUNCH with no countdown.

import { KICKSTARTER_PRELAUNCH_URL } from './kickstarterLink';

export type CampaignPhase = 'PRELAUNCH' | 'LIVE' | 'ENDED' | 'EVERGREEN';

// Launch and close instants in UTC, or null while no date is set. The
// `as` keeps the declared type `number | null` inside this module too, so
// the null checks below stay meaningful once a date is filled in.
// 09:00 PDT on 27 Oct 2027; the 28-day campaign (the Kickstarter page's
// duration) closes 09:00 PST on 24 Nov 2027.
export const LAUNCH_TS = Date.parse('2027-10-27T16:00:00Z') as number | null;
export const END_TS = Date.parse('2027-11-24T17:00:00Z') as number | null;

// Human-readable launch timing for copy. One place to change it.
export const LAUNCH_LABEL = 'October 27, 2027';

// The live-campaign URL is NOT the pre-launch URL — Kickstarter issues a
// different one when the project goes live. Until that is known this
// stays empty and every LIVE-phase link falls back to the pre-launch URL
// rather than rendering a dead href. Fill it in when the campaign goes live.
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
  if (LAUNCH_TS === null || now < LAUNCH_TS) return 'PRELAUNCH';
  if (END_TS === null || now < END_TS) return 'LIVE';
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

// Generated in the Kickstarter dashboard 2026-08-03. NOTE: Kickstarter
// does NOT use the label you type — it mints its own opaque 6-character
// tag and that is what its analytics count. The label is only a
// human-readable name in the dashboard, so the mapping below is the
// label we chose -> the tag KS actually issued. Don't "tidy" these into
// readable strings; they would stop matching.
export const KICKSTARTER_REF_TAGS: Partial<Record<CampaignSurface, string>> = {
  postgame: 'jmx8kf', //          label: game_postgame
  'kickstarter-page': '1dbtqx', // label: site_kickstarter
  umbrella: '6uzexc', //          label: site_umbrella
  store: 'a8bsfx', //             label: site_store
  studio: 'dqr5ne', //            label: site_studio
  'volume-zero': 'x8q1ec', //     label: site_comic
  io: '376snn', //                label: site_lab
  inline: 'bzbs9c', //            label: site_inline
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
        text: `Thresan: Skyflag comes to Kickstarter on ${LAUNCH_LABEL}.`,
        cta: 'Follow the campaign',
        href: campaignUrl(phase, surface),
      };
    case 'LIVE':
      return {
        text: 'Thresan: Skyflag is live on Kickstarter. Back the physical edition before the campaign closes.',
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
