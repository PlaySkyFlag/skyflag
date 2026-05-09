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

- [ ] **Add a "Disable notifications" toggle.** `getExistingSubscription`
      and `disablePush` in `src/game/push.ts` are exported but unused —
      a user who taps Enable can't turn it off in-app.
- [ ] **`ROOM_MAX_AGE_MS` is enforced on join but rooms are never
      deleted** (`src/Multiplayer.tsx:23`). Rows accumulate forever.
      Add a scheduled cleanup (pg_cron) that deletes rooms older than
      a few days.
- [x] ~~Re-read `Tutorial.tsx` start-to-finish before launch.~~
      Found one stale reference ("Tutorial button in the help row") —
      updated to point to the sidebar tab. Rest checked clean.
- [x] ~~CSS orphans in `src/App.css`:~~
      `.hud-mute-btn`, `.help-row`, `.help-row > .help`,
      `.help-tutorial-btn` removed; Tournaments comment refreshed.
- [ ] **`apply-rating` Edge Function** reads `state.status.winner` and
      relies on short-circuit evaluation against `status.kind === 'won'`.
      Correct today, but a refactor of `GameStatus` could regress
      silently. Add an explicit narrow.

## Nice to have

- [ ] **Add a React error boundary** around `<App />` in `src/main.tsx`.
      Today any crash in the SVG board / AI worker / Supabase callback
      brings down the whole UI to a blank page.
- [ ] **Supabase-down resilience.** State is pushed on every dispatch
      with no retry/queue. A network blip mid-game loses the move from
      the server's view but keeps it locally. A "last push failed"
      indicator + manual retry button would close the gap.
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
