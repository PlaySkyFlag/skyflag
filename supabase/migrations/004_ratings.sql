-- ELO rating support. Each profile gets a rating (default 1200, the
-- standard chess starting point). Per-game results are written by the
-- apply-rating Edge Function to a separate table — the table doubles as
-- an idempotency guard (PRIMARY KEY on room_code makes the rating
-- update happen exactly once per game even if both clients call the
-- function).

alter table public.profiles
  add column if not exists rating int not null default 1200,
  add column if not exists games_played int not null default 0;

create table if not exists public.game_results (
  room_code             text primary key,
  winner_user_id        uuid references auth.users(id) on delete set null,
  loser_user_id         uuid references auth.users(id) on delete set null,
  is_draw               boolean not null default false,
  winner_rating_before  int,
  loser_rating_before   int,
  winner_rating_after   int,
  loser_rating_after    int,
  created_at            timestamptz not null default now()
);

alter table public.game_results enable row level security;

-- Anyone can read game results (so a player can show their opponent the
-- rating delta on the end-game card). Inserts only via the service-role
-- key inside the Edge Function — clients can't write directly.
drop policy if exists "game results readable" on public.game_results;
create policy "game results readable"
  on public.game_results for select
  using (true);
