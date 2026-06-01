-- Gate all Kit (marketing) sync on express consent (CASL/GDPR).
-- After this, a waitlist row only reaches Kit if consent IS TRUE. Forms
-- without a consent checkbox can no longer leak subscribers into the
-- marketing list, regardless of front-end state.

-- 1. The insert -> Kit-subscriber sync only fires for consented rows.
DROP TRIGGER IF EXISTS trg_sync_waitlist_to_kit ON public.thresan_waitlist;
CREATE TRIGGER trg_sync_waitlist_to_kit
  AFTER INSERT ON public.thresan_waitlist
  FOR EACH ROW
  WHEN (NEW.consent IS TRUE)
  EXECUTE FUNCTION public.sync_waitlist_to_kit();

-- 2. The deferred tagger only tags consented rows (un-consented rows are
--    never synced, so tagging them would 404 against Kit).
CREATE OR REPLACE FUNCTION public.tag_new_signups_to_kit()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'net', 'extensions'
AS $function$
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
           where kit_tagged = false and coalesce(consent, false) = true and created_at < now() - interval '1 minute' loop
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
end; $function$;
