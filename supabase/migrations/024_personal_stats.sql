-- Server-side personal game history. Replaces (and is backfilled from)
-- the localStorage-only `3phor.stats.v1` so a user's stats survive
-- device switches, browser-data clears, and sign-out/sign-in cycles.
--
-- One row per finished game across all modes that have a clear "your
-- side" (1P vs AI, online MP). 2P hot-seat is still excluded since both
-- sides are the same human.
--
-- Differs from `game_results` (migration 004): that table is the online-MP
-- rating-adjustment log, written server-side by the apply-rating Edge
-- Function and keyed by room_code. This table is per-user personal
-- history, written by the client on game-end, and includes solo-vs-AI
-- games which don't have a room_code.
--
-- `client_id` is generated client-side (UUID per GameRecord). It serves
-- two purposes:
--   1. Idempotency on retries — a stuck network or duplicate write loop
--      can't double-insert a game.
--   2. Backfill dedup — when a user signs in on a second device with
--      its own localStorage history, the backfill INSERT ... ON CONFLICT
--      DO NOTHING merges rather than duplicates.

create table if not exists public.personal_games (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       uuid not null,
  mode            text not null,
  result          text not null check (result in ('win', 'loss', 'draw')),
  reason          text not null,
  turns           int not null,
  played_at       timestamptz not null default now(),
  unique (user_id, client_id)
);

-- Read-path index: every stats summary query is "this user's rows,
-- newest first". Without the desc-on-played_at index, the stats modal
-- would do a full table scan once we have a few thousand testers.
create index if not exists personal_games_user_id_played_at_idx
  on public.personal_games (user_id, played_at desc);

alter table public.personal_games enable row level security;

-- Read: owner only. No cross-user visibility — this is personal history.
drop policy if exists "personal games readable by owner" on public.personal_games;
create policy "personal games readable by owner"
  on public.personal_games for select
  using (auth.uid() = user_id);

-- Insert: owner only. Client-side writes on every game-end and on
-- localStorage→server backfill on first signed-in load.
drop policy if exists "personal games insertable by owner" on public.personal_games;
create policy "personal games insertable by owner"
  on public.personal_games for insert
  with check (auth.uid() = user_id);

-- Delete: owner only. Powers the "Clear stats" button in the stats
-- modal and the GDPR-style account-deletion data-export flow.
drop policy if exists "personal games deletable by owner" on public.personal_games;
create policy "personal games deletable by owner"
  on public.personal_games for delete
  using (auth.uid() = user_id);
