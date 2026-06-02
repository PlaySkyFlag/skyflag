-- 032: Switch the marketing sync from Kit (ConvertKit) to MailerLite.
--
-- Why: MailerLite's FREE tier includes automations (Kit's free tier does
-- not), so the welcome email + nurture sequence can run at no cost during
-- the Kickstarter campaign. Supabase stays the source of truth — this only
-- changes which ESP a consented signup is mirrored to.
--
-- Safety: this ADDS the MailerLite sync but LEAVES the Kit triggers running,
-- so there's no notify gap while we verify MailerLite. Once a real test
-- signup is confirmed in MailerLite, a follow-up migration disables the Kit
-- trigger + the kit-tag-sync cron. Like the Kit sync, this is fire-and-
-- forget via pg_net (never blocks the insert) and no-ops until configured.
--
-- Secrets to add in Supabase Vault before this does anything:
--   mailerlite_api_key   — MailerLite token (MailerLite → Integrations → API)
--   mailerlite_group_id  — id of the group new signups join; this is also
--                          the group the welcome automation triggers on.
-- Segmentation: source + interests ride along as MailerLite custom fields
-- (created during setup), so you can segment/automate on them in the UI.

create extension if not exists pg_net;

create or replace function public.sync_waitlist_to_mailerlite()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net, extensions
as $fn$
declare
  ml_key   text;
  ml_group text;
  interests_csv text;
begin
  select decrypted_secret into ml_key
    from vault.decrypted_secrets where name = 'mailerlite_api_key' limit 1;
  if ml_key is null then
    return new;  -- not configured yet; no-op (never blocks the signup)
  end if;
  select decrypted_secret into ml_group
    from vault.decrypted_secrets where name = 'mailerlite_group_id' limit 1;

  interests_csv := coalesce(
    (select string_agg(value, ',') from jsonb_array_elements_text(new.interests)),
    ''
  );

  -- MailerLite upserts on email; adding to the group is what fires the
  -- welcome automation. groups omitted if the id secret isn't set yet.
  perform net.http_post(
    url := 'https://connect.mailerlite.com/api/subscribers',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Accept',        'application/json',
      'Authorization', 'Bearer ' || ml_key
    ),
    body := jsonb_build_object(
      'email', new.email,
      'fields', jsonb_build_object(
        'source',    coalesce(new.source, 'website'),
        'interests', interests_csv
      )
    ) || case when ml_group is not null
              then jsonb_build_object('groups', jsonb_build_array(ml_group))
              else '{}'::jsonb end
  );
  return new;
end;
$fn$;

drop trigger if exists trg_sync_waitlist_to_mailerlite on public.thresan_waitlist;
create trigger trg_sync_waitlist_to_mailerlite
  after insert on public.thresan_waitlist
  for each row
  when (new.consent is true)
  execute function public.sync_waitlist_to_mailerlite();
