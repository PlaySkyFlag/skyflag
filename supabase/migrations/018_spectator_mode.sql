-- Spectator mode v1 (light) — tournament games are automatically
-- public so anyone (signed in or anonymous) can watch them live.
-- Casual games stay private unless explicitly opted in later.
--
-- Three pieces here:
--   1. is_public column on games (defaults false → private)
--   2. Trigger that flips is_public to true when p2_id is set AND
--      both players are entered in the same active tournament
--   3. Updated SELECT policy so public games are readable by anyone

alter table public.games
  add column if not exists is_public boolean not null default false;

-- Helpful index for the "list public games" query in the Spectate
-- panel. Partial index keeps it tiny — typically a small minority of
-- games are tournament games.
create index if not exists games_is_public_idx
  on public.games (created_at desc) where is_public = true;

-- Auto-flip-to-public trigger. Fires when p2_id transitions from
-- NULL to set (someone joined a previously-open room). If both p1
-- and p2 are entered in any currently-active tournament, mark
-- the game public so spectators can watch.
create or replace function public.maybe_mark_game_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shared_count int;
begin
  -- Only react to the "p2 just joined" transition.
  if old.p2_id is not null or new.p2_id is null then
    return new;
  end if;

  select count(*) into shared_count
  from public.tournament_entries te1
  join public.tournament_entries te2
    on te1.tournament_id = te2.tournament_id
  join public.tournaments t
    on t.id = te1.tournament_id
  where te1.user_id::text = new.p1_id::text
    and te2.user_id::text = new.p2_id::text
    and t.cancelled_at is null
    and t.starts_at <= now()
    and t.ends_at   >  now();

  if shared_count > 0 then
    new.is_public := true;
  end if;
  return new;
end;
$$;

drop trigger if exists games_mark_public_trg on public.games;
create trigger games_mark_public_trg
  before update of p2_id on public.games
  for each row
  execute function public.maybe_mark_game_public();

-- Permit public read access to public games on top of the existing
-- participants-only policy. Anyone (including anon) may select rows
-- where is_public = true.
drop policy if exists "games select public" on public.games;
create policy "games select public"
  on public.games for select
  using (is_public = true);
