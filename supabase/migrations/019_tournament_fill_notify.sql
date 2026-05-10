-- Tournament-fill push notifications.
--
-- Goal: when a new tournament is created (especially user-created ones),
-- notify opted-in users so the roster fills up before play starts. Push
-- delivery uses the existing push_subscriptions table; this migration
-- adds the opt-in flag and a sent-log to prevent double-notifying.
--
-- Storage tradeoff:
--   - The opt-in flag lives on profiles (single boolean per user).
--   - The sent-log is its own table so notify-tournament-fill can do an
--     atomic "was this user already notified for this tournament?" check
--     without a transaction-wide profiles lock.
--
-- Default for new + existing users is FALSE. Users explicitly opt in via
-- a toggle in AccountModal; otherwise they get no fill-pushes (only the
-- per-game turn notifications that pre-existed).

alter table public.profiles
  add column if not exists notify_tournament_fill boolean not null default false;

-- One row per (user, tournament) pair where we sent (or attempted) a
-- fill push. Used as a de-dup gate so a re-run of the edge function
-- doesn't double-notify a user.
create table if not exists public.tournament_fill_notifications (
  user_id       uuid not null references auth.users(id)         on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  sent_at       timestamptz not null default now(),
  primary key (user_id, tournament_id)
);

alter table public.tournament_fill_notifications enable row level security;

-- Users can read their own log rows (so the UI could later show a
-- "notified" pill on tournaments). Writes are service-role only —
-- the edge function bypasses RLS.
drop policy if exists "users read own fill log" on public.tournament_fill_notifications;
create policy "users read own fill log"
  on public.tournament_fill_notifications for select
  using (auth.uid() = user_id);
