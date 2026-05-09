-- Periodic cleanup of stale games rows. ROOM_MAX_AGE_MS in
-- src/Multiplayer.tsx blocks joining a 24h-old room, but rows with no
-- p2 (abandoned challenge offers) and rows from finished games never
-- get pruned — left alone they grow forever.
--
-- This migration creates a SECURITY DEFINER prune function and tries
-- to schedule it daily via pg_cron. If pg_cron isn't enabled on this
-- project (Supabase has it available on all tiers but it must be
-- toggled on in Database → Extensions), the schedule step silently
-- no-ops and you can call `select public.prune_old_games();` manually
-- from the SQL editor whenever you remember.

create or replace function public.prune_old_games()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.games
  where created_at < now() - interval '7 days';
$$;

-- Lock the function down — it's only useful as a scheduled job.
revoke all on function public.prune_old_games() from public;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- cron.schedule is idempotent on (jobname, command) — re-running
    -- the migration won't pile up duplicate schedules.
    perform cron.schedule(
      'skyflag-prune-old-games',
      '17 3 * * *',  -- 03:17 UTC daily — quiet time, off the hour.
      $cmd$select public.prune_old_games();$cmd$
    );
  end if;
end $$;
