-- Rate-limit table for the use-recovery-code Edge Function.
--
-- Why: recovery codes are 16-char alphanumeric (high entropy, ~80 bits)
-- so brute-force at the per-request level isn't feasible — but without
-- a rate limit, an attacker who knows the target's email can grind
-- attempts unbounded, raising the practical chance of a hit and
-- generating support-noise / log spam. Also lets us cap per-IP volume
-- to slow distributed-credential-stuffing attacks.
--
-- The Edge Function inserts a row on every attempt (success or fail)
-- and SELECTs the recent-window count keyed by (email) and (ip) before
-- accepting the next attempt. Old rows expire via a SECURITY DEFINER
-- cleanup function called by pg_cron (best-effort; the lookup window
-- is small enough that stale rows are harmless even if cleanup lags).

create table if not exists public.recovery_code_attempts (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  ip              text,
  attempted_at    timestamptz not null default now(),
  success         boolean not null default false
);

-- Index supports the two lookup paths the function uses: by email
-- (per-account throttle) and by ip (per-source throttle). Both are
-- filtered by attempted_at within the recent window.
create index if not exists recovery_code_attempts_email_idx
  on public.recovery_code_attempts (email, attempted_at desc);
create index if not exists recovery_code_attempts_ip_idx
  on public.recovery_code_attempts (ip, attempted_at desc)
  where ip is not null;

alter table public.recovery_code_attempts enable row level security;

-- No client-facing access — only the Edge Function (service role)
-- writes/reads this table. Empty policy set with RLS on means
-- non-service-role clients can't reach it.

-- Cleanup function: trim rows older than 1 day. The Edge Function only
-- looks back ~10 minutes for rate-limit decisions, so anything older is
-- pure history we don't need to keep online.
create or replace function public.prune_recovery_code_attempts()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  delete from public.recovery_code_attempts
  where attempted_at < now() - interval '1 day';
end;
$$;

revoke all on function public.prune_recovery_code_attempts() from public;

-- Schedule cleanup daily IF pg_cron is enabled. Wrapped in a do-block
-- with an existence check so the migration is safe to run on projects
-- where pg_cron isn't available — same pattern as 008_games_cleanup.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'prune_recovery_code_attempts_daily',
      '23 3 * * *',
      $cron$select public.prune_recovery_code_attempts();$cron$
    );
  end if;
exception when others then
  -- Schedule already exists or some other transient — non-fatal.
  null;
end$$;
