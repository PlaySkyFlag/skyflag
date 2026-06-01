-- 031: Restore anon INSERT on thresan_waitlist.
--
-- Found 2026-06-01 during an end-to-end funnel test: the live INSERT path
-- used by the /kickstarter form (Supabase publishable/anon key) was being
-- rejected with 42501 "new row violates row-level security policy", while
-- a service-role insert of the same row succeeded. The live policy/grants
-- had drifted from migration 026 (which intends anon to be able to insert),
-- almost certainly during the consent/Kit work applied via the Management
-- API. Net effect: the waitlist could not capture ANY email from the
-- public site. This restores capture.
--
-- 42501 on an INSERT can mean either (a) no permissive INSERT policy for
-- the role, or (b) the role lacks the table-level INSERT privilege. We fix
-- both so the form works regardless of which drifted.
--
-- Consent is still enforced where it matters: the Kit (marketing) sync
-- trigger only fires WHEN consent IS TRUE (migration 030). DB-level capture
-- stays permissive so no signup is ever silently dropped before it's saved.

alter table public.thresan_waitlist enable row level security;

drop policy if exists "anyone can join thresan waitlist" on public.thresan_waitlist;
create policy "anyone can join thresan waitlist"
  on public.thresan_waitlist for insert
  to anon, authenticated
  with check (true);

grant insert on public.thresan_waitlist to anon, authenticated;

-- Verify after applying (should return 201, not 42501):
--   curl -sS -X POST "$URL/rest/v1/thresan_waitlist" \
--     -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $PUBLISHABLE_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{"email":"verify@example.com","source":"thresan-kickstarter","consent":true}'
