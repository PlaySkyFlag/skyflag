-- Spectator mode v2 — per-side opt-in for casual games.
--
-- v1 (migration 018) only auto-publishes tournament games where both
-- players are entered in the same active tournament. Casual games stay
-- private. v2 lets casual players opt in to public spectating, but
-- requires *both* sides to consent — one player exposing their
-- opponent's play to spectators without permission would be a privacy
-- violation.
--
-- Columns p1_public_opt_in / p2_public_opt_in track each side's
-- consent. A trigger reconciles `is_public`: true iff both sides have
-- opted in (or the v1 tournament-auto path has set it directly).
-- Either player flipping their consent off pulls the game back to
-- private immediately.
--
-- Note: the v1 trigger sets is_public directly when a tournament game
-- starts. We don't want this v2 trigger to undo that. So the rule is:
--   - is_public flips to true ONLY when both opt-ins are true OR when
--     it was already true (preserving v1's tournament-auto behavior).
--   - is_public flips to false when either opt-in is false AND the
--     game isn't a tournament game.
-- The cleanest way to express that is: tournament-membership is checked
-- inline by re-using the same shared-tournament query from v1.

alter table public.games
  add column if not exists p1_public_opt_in boolean not null default false,
  add column if not exists p2_public_opt_in boolean not null default false;

create or replace function public.reconcile_game_is_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shared_count int := 0;
begin
  -- Only react to opt-in flag changes; the v1 trigger handles the
  -- p2-just-joined case for tournament games.
  if old.p1_public_opt_in is not distinct from new.p1_public_opt_in
     and old.p2_public_opt_in is not distinct from new.p2_public_opt_in then
    return new;
  end if;

  if new.p1_public_opt_in and new.p2_public_opt_in then
    new.is_public := true;
    return new;
  end if;

  -- One side withdrew. Don't pull a tournament game off public — the
  -- tournament-auto path is binding for as long as both players are
  -- in the same active tournament.
  if new.p1_id is not null and new.p2_id is not null then
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
  end if;

  if shared_count > 0 then
    new.is_public := true;
  else
    new.is_public := false;
  end if;
  return new;
end;
$$;

drop trigger if exists games_reconcile_public_trg on public.games;
create trigger games_reconcile_public_trg
  before update of p1_public_opt_in, p2_public_opt_in on public.games
  for each row
  execute function public.reconcile_game_is_public();
