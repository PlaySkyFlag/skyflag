# 3phor Cleanup TODO

Audit captured 2026-05-08 after Pass 1+2 polish. Pick items off as time
allows; nothing here is blocking gameplay.

## Must fix

- [x] ~~Help.tsx references removed UI.~~ Steps rewritten to point to
      the gear menu and the in-game toolbar, end-turn note clarifies
      it's automatic, plus a Hint pointer was added.
- [x] ~~getEffectiveUserId fallback can't pass RLS.~~ Multiplayer's
      Create room / Join now hide for anonymous users with a "Sign in
      to play online" prompt.
- [x] ~~No migration for the games table.~~ Added `000_games.sql`
      (idempotent against the existing remote thanks to
      `if not exists`).

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
- [x] ~~StatusBar REASON_LABEL duplicates the GameStatus union.~~
      Both StatusBar and EndGameOverlay now derive `WonReason` /
      `DrawReason` via `Extract<GameStatus, …>['reason']`; adding a
      new reason to the type now trips a type error in both places.
- [x] ~~Stats credit for 2P hot-seat is silently dropped.~~ StatsModal
      now shows a small disclaimer explaining the omission.
- [x] ~~iOS push prompts anonymous users.~~ NotificationsControl now
      shows a "Sign in to enable turn notifications" hint when
      `authUser === null`, hiding the Enable button entirely until
      sign-in instead of letting them tap it for nothing.

## Already-on-roadmap (not part of cleanup)

These are deferred features tracked separately:
- ~~Daily puzzle~~ (shipped 2026-05-08, MVP — AI-generated position +
  AI's depth-3 pick as the answer; not curated for tactical sharpness)
- ~~Time controls~~ (shipped 2026-05-08, MVP — 5/10/30 min options)
- Async multiplayer push notifications (iOS APNs cert + Supabase secrets
  are user-side manual setup)
- **Stronger AI** — match what modern chess apps do. Practical wins for
  3phor: (a) richer evaluation (king safety, piece coordination,
  flag-runner threat tempo, control of lifts/Nexus rather than just
  material), (b) killer-move + history heuristic move ordering on top
  of the existing iterative-deepening transposition table, (c) null-move
  pruning, late-move reduction, (d) a small opening book of strong
  early deploy patterns, (e) time management — spend more search
  budget on critical positions instead of fixed depth. (NNUE neural
  evaluation is the chess-app gold standard but probably overkill
  unless we generate training games at scale.)
