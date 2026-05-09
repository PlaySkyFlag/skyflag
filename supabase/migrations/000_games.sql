-- Foundational `games` table — backstops every multiplayer feature in
-- this codebase. Originally created in the Supabase dashboard before
-- migrations existed, so the table itself wasn't tracked. Migrations
-- 002–007 reference it without owning it; this file closes the loop so
-- the project can be reproduced from migrations alone.
--
-- All `if not exists` so re-applying on the existing remote is a no-op.
-- Column types match what the dashboard table set up: id (uuid pk),
-- text user-id columns (RLS in 007 casts both sides to text so this
-- works whether legacy or future setups use text or uuid).

create table if not exists public.games (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null,
  state       jsonb not null,
  p1_id       text not null,
  p2_id       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Codes are short (4 chars from a 30-glyph alphabet) — uniqueness is
-- enforced so generateRoomCode()'s collision-retry loop in
-- src/Multiplayer.tsx can rely on a 23505 from the DB.
create unique index if not exists games_room_code_key on public.games(room_code);

-- Realtime subscriptions filter on room_code; this index keeps lookups
-- snappy as the table grows.
create index if not exists games_room_code_idx on public.games(room_code);

-- Auto-bump updated_at on any row update so realtime listeners see a
-- fresh timestamp without each writer remembering to set it manually.
create or replace function public.games_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.games_set_updated_at();
