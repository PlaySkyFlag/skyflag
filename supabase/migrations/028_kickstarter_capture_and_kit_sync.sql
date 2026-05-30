-- 028: Kickstarter capture fields + live Supabase → Kit (ConvertKit) sync.
--
-- Applied to the live project on 2026-05-30 via the Management API; this
-- file documents it so the schema is reproducible (all statements are
-- idempotent). The Kit API key is NOT in source — it lives in Supabase
-- Vault under the name 'kit_api_key', set out-of-band with:
--   select vault.create_secret('<kit v4 key>', 'kit_api_key', 'Kit sync');

-- ── Capture fields for the /kickstarter landing page ──────────────────
-- interests: segmentation checkboxes (backing / updates / novel).
-- consent:   CASL/GDPR express-consent flag (the page requires it).
alter table public.thresan_waitlist
  add column if not exists interests jsonb not null default '[]'::jsonb,
  add column if not exists consent boolean not null default false;

-- ── Live sync: every new signup → Kit, tagged by source ───────────────
-- pg_net posts asynchronously to Kit's v4 upsert endpoint; the key is read
-- from Vault at call time, so it never sits in the trigger body or git.
create extension if not exists pg_net;

create or replace function public.sync_waitlist_to_kit()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net, extensions
as $$
declare
  kit_key text;
begin
  select decrypted_secret into kit_key
    from vault.decrypted_secrets where name = 'kit_api_key' limit 1;
  if kit_key is null then
    return new;
  end if;
  perform net.http_post(
    url := 'https://api.kit.com/v4/subscribers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Kit-Api-Key', kit_key
    ),
    body := jsonb_build_object(
      'email_address', new.email,
      'fields', jsonb_build_object('source', coalesce(new.source, 'website'))
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_sync_waitlist_to_kit on public.thresan_waitlist;
create trigger trg_sync_waitlist_to_kit
  after insert on public.thresan_waitlist
  for each row execute function public.sync_waitlist_to_kit();
