-- Weekly KPI report — pg_cron schedule.
--
-- Fires every Monday at 09:00 UTC (~05:00 ET / 02:00 PT — early
-- enough that the report is in the inbox before Monday gets going).
-- The cron job posts to the weekly-report Edge Function with a
-- shared secret; the function uses the service-role client to read
-- kpi_snapshot bypassing the is_admin() check, then fans out the
-- email via Resend.
--
-- This migration is idempotent and gated: it only schedules the job
-- if pg_cron + pg_net extensions are enabled AND the matching
-- secrets (cron_secret + supabase_url + service_role_key) are
-- present in vault. If either is missing, the migration logs a
-- NOTICE and skips — the cron job can be added later without
-- re-running migrations.
--
-- Manual setup steps before this becomes live:
--   1. Database → Extensions → enable pg_cron and pg_net.
--   2. Project Settings → Vault → store these secrets:
--        - cron_secret: a random string (any UUID-ish value works);
--          must match what's in CRON_SECRET on the Edge Function.
--        - supabase_url: the project URL.
--        - service_role_key: the service-role JWT.
--   3. supabase secrets set CRON_SECRET=<same random string>
--                            RESEND_API_KEY=re_xxx
--                            REPORT_FROM_EMAIL='3phor reports <reports@3phor.io>'
--                            REPORT_TO_EMAIL=njatel@limnology.ca
--   4. Re-run this migration (or run the body manually) to install
--      the cron job.

do $$
declare
  has_cron boolean;
  has_net  boolean;
  cron_secret text;
  supabase_url text;
  service_role_key text;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron')
    into has_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net')
    into has_net;

  if not has_cron or not has_net then
    raise notice
      'Skipping weekly-report cron schedule — pg_cron or pg_net not enabled. Enable both, set vault secrets, then re-run this migration.';
    return;
  end if;

  -- Try to read the secrets from Supabase Vault. supabase_vault is
  -- a built-in extension on hosted Supabase; the secrets table
  -- exposes name → decrypted value via the vault.decrypted_secrets
  -- view. If the secrets aren't set yet we bail with a notice.
  begin
    select decrypted_secret into cron_secret
      from vault.decrypted_secrets where name = 'cron_secret' limit 1;
    select decrypted_secret into supabase_url
      from vault.decrypted_secrets where name = 'supabase_url' limit 1;
    select decrypted_secret into service_role_key
      from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  exception
    when others then
      raise notice
        'Skipping weekly-report cron schedule — vault secrets not readable: %', sqlerrm;
      return;
  end;

  if cron_secret is null or supabase_url is null or service_role_key is null then
    raise notice
      'Skipping weekly-report cron schedule — required vault secrets (cron_secret, supabase_url, service_role_key) not all present.';
    return;
  end if;

  -- Drop any prior schedule so this is idempotent.
  perform cron.unschedule('weekly-report')
    where exists (select 1 from cron.job where jobname = 'weekly-report');

  -- Monday 09:00 UTC. cron syntax: minute hour day-of-month month day-of-week.
  perform cron.schedule(
    'weekly-report',
    '0 9 * * 1',
    format($cron$
      select net.http_post(
        url := %L || '/functions/v1/weekly-report',
        headers := jsonb_build_object(
          'content-type',  'application/json',
          'authorization', 'Bearer ' || %L
        ),
        body := jsonb_build_object(
          'mode',         'cron',
          'cron_secret',  %L
        )
      )
    $cron$, supabase_url, service_role_key, cron_secret)
  );

  raise notice 'Weekly-report cron scheduled for Monday 09:00 UTC.';
end $$;
