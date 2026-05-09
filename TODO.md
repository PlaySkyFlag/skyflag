# SkyFlag Cleanup TODO

Audit captured 2026-05-08 after Pass 1+2 polish. Pick items off as time
allows; nothing here is blocking gameplay.

## Must fix

- [ ] **`Help.tsx` references removed UI.** Steps still tell users to
      "choose a mode from the dropdown in the HUD", "click New game in
      the HUD", and "End the turn by clicking End turn in the HUD". Mode
      moved to the gear menu, end-turn is automatic. Misleads first-time
      players exactly when they need orientation.
- [ ] **`getEffectiveUserId` falls back to a localStorage UUID that
      cannot pass RLS.** Anonymous users clicking Create room or Join
      will fail RLS silently with a confusing 42501 error. Either remove
      the fallback or disable Create/Join when `authUser === null` in
      `Multiplayer.tsx`.
- [ ] **No migration for the `games` table.** Migrations 001–007 all
      reference `public.games` but the table itself was created in the
      Supabase dashboard. Anyone re-bootstrapping the project from
      migrations alone will fail at 007. Owe a `000_games.sql` (or fold
      into 007).

## Should fix

- [x] ~~Add a "Disable notifications" toggle.~~ NotificationsControl
      now queries push_subscriptions on mount and shows Disable when a
      row exists; click → server delete + (web) local unsubscribe.
- [x] ~~ROOM_MAX_AGE_MS cleanup.~~ Migration 008 adds a
      `prune_old_games()` SECURITY DEFINER function and conditionally
      schedules it via pg_cron at 03:17 UTC daily. (If pg_cron isn't
      enabled in Supabase Database → Extensions, the schedule is a
      no-op and you can run `select public.prune_old_games();`
      manually from the SQL editor.)
- [x] ~~Re-read `Tutorial.tsx` start-to-finish before launch.~~
      Found one stale reference ("Tutorial button in the help row") —
      updated to point to the sidebar tab. Rest checked clean.
- [x] ~~CSS orphans in `src/App.css`:~~
      `.hud-mute-btn`, `.help-row`, `.help-row > .help`,
      `.help-tutorial-btn` removed; Tournaments comment refreshed.
- [x] ~~apply-rating type narrow.~~ Local `WonStatus | DrawStatus |
      InProgressStatus` shape with explicit `winner: 'p1' | 'p2'`
      narrow at line 90; future GameStatus refactors will trip a
      type error here instead of silently degrading.

## Nice to have

- [x] ~~React error boundary around `<App />`.~~ ErrorBoundary class
      wrapped at main.tsx; renders a card with the message + Reload /
      Try-again-without-reload buttons instead of a blank page.
- [x] ~~Supabase-down resilience.~~ A failed games.state push now
      flips a `pushFailed` flag; sync-banner pinned bottom-right with
      a Retry button bumps a nonce that re-runs the push effect with
      the current state. Successful retry clears the banner.
- [ ] **`StatusBar.tsx` REASON_LABEL duplicates the `GameStatus` union.**
      Hand-kept in sync. Derive via `keyof` or co-locate.
- [ ] **Stats credit for 2P hot-seat is silently dropped.** Mention this
      in StatsModal so users aren't confused why "Total games" lags
      actual play.
- [ ] **iOS push only saves the APNs token if `authUser && supabase`**
      (`src/Multiplayer.tsx:128`). Anonymous users get permission prompts
      they can't actually use. Gate the button on `authUser` upfront.

## Already-on-roadmap (not part of cleanup)

These are deferred features tracked separately:
- Daily puzzle
- Time controls
- Async multiplayer push notifications (iOS APNs cert + Supabase secrets
  are user-side manual setup)
