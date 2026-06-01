// The live Kickstarter PRE-LAUNCH page. Single source of truth so every
// "Follow on Kickstarter" CTA points at the same place and updates in one
// spot. Named to match the established convention: KICKSTARTER_PRELAUNCH_URL
// is the pre-launch follow page; ThresanStore's separate (local)
// KICKSTARTER_URL is the LIVE-campaign URL it flips to once we launch.
//
// Pre-launch strategy: we capture the email (a list we own and nurture)
// AND drive a Kickstarter follow. Followers get auto-notified the instant
// we launch, which front-loads the first-48h surge that Kickstarter's
// algorithm and backer momentum both reward. Both, not either.
//
// Brand assets / official "Follow us on Kickstarter" badges:
//   https://www.kickstarter.com/help/brand_assets
export const KICKSTARTER_PRELAUNCH_URL =
  'https://www.kickstarter.com/projects/nelsonjatel/thresan-skyflag-chess-meets-capture-the-flag-in-3d';
