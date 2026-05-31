-- 029: Kit tag taxonomy + deferred auto-tagging sweep.
--
-- Applied live 2026-05-31 via the Management API; documented here for
-- reproducibility. Tags themselves live in Kit (created via the v4 API):
--   surfaces  src:kickstarter-page/store/world/studio/volume-zero/hub/lab/games/website
--   interests wants:backing / wants:updates / wants:novel
-- The numeric tag IDs below are this Kit account's IDs (not secrets).
--
-- Why a sweep and not the insert trigger: pg_net fires all HTTP calls
-- concurrently, so tagging in the trigger races the subscriber-creation
-- upsert and 404s (the tag-by-email endpoint needs the subscriber to
-- exist). The sweep tags rows >1 minute old, by which point the trigger's
-- upsert has created the Kit subscriber. pg_cron runs it every 2 minutes.

alter table public.thresan_waitlist
  add column if not exists kit_tagged boolean not null default false;

create or replace function public.tag_new_signups_to_kit()
returns void language plpgsql security definer
set search_path = public, vault, net, extensions as $$
declare
  kit_key text; hdr jsonb;
  src_map jsonb := '{"thresan-kickstarter":19927965,"thresan-store":19927967,"thresan-world":19927971,"thresan-studio-kickstarter":19927968,"thresan-volume-zero-kickstarter":19927969,"thresan-com":19927964,"thresan-io":19927966,"thresan-games":19927963,"website":19927970}'::jsonb;
  int_map jsonb := '{"backing":19927972,"updates":19927974,"novel":19927973}'::jsonb;
  r record; src_tag bigint; itag bigint; iv text;
begin
  select decrypted_secret into kit_key from vault.decrypted_secrets where name='kit_api_key' limit 1;
  if kit_key is null then return; end if;
  hdr := jsonb_build_object('Content-Type','application/json','X-Kit-Api-Key',kit_key);
  for r in select * from public.thresan_waitlist
           where kit_tagged = false and created_at < now() - interval '1 minute' loop
    src_tag := (src_map ->> coalesce(r.source,'website'))::bigint;
    if src_tag is not null then
      perform net.http_post(url:='https://api.kit.com/v4/tags/'||src_tag||'/subscribers',
        headers:=hdr, body:=jsonb_build_object('email_address', r.email));
    end if;
    if r.interests is not null and jsonb_typeof(r.interests)='array' then
      for iv in select jsonb_array_elements_text(r.interests) loop
        itag := (int_map ->> iv)::bigint;
        if itag is not null then
          perform net.http_post(url:='https://api.kit.com/v4/tags/'||itag||'/subscribers',
            headers:=hdr, body:=jsonb_build_object('email_address', r.email));
        end if;
      end loop;
    end if;
    update public.thresan_waitlist set kit_tagged = true where id = r.id;
  end loop;
end; $$;

create extension if not exists pg_cron;
-- select cron.schedule('kit-tag-sync', '*/2 * * * *', $$select public.tag_new_signups_to_kit();$$);
