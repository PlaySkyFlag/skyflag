-- 034: Token-gated read-only RPC for the CRM dashboard (least-privilege).
--
-- Applied live 2026-06-03. The thresan-crm Shiny dashboard previously read
-- the waitlist with the SERVICE-ROLE key, which (when bundled into the
-- shinyapps deploy) carried full DB access. This replaces that with a
-- read-only path: the CRM uses the PUBLIC anon key + a scoped token to call
-- this SECURITY DEFINER function. A leaked CRM bundle can then only read the
-- waitlist via this function — never write or reach other tables.
--
-- The anon key alone still returns nothing on the table (no SELECT policy,
-- by design); this function additionally requires the token, which lives in
-- Vault as 'crm_read_token' (set out-of-band, NOT in git):
--   select vault.create_secret('<token>', 'crm_read_token', 'CRM read-only RPC token');

create or replace function public.crm_get_waitlist(p_token text)
returns setof public.thresan_waitlist
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  expected text;
begin
  select decrypted_secret into expected
    from vault.decrypted_secrets where name = 'crm_read_token' limit 1;
  if expected is null or p_token is null or p_token <> expected then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query select * from public.thresan_waitlist order by created_at asc;
end;
$$;

-- Only the anon role (the CRM uses the publishable key + token) may call it.
revoke all on function public.crm_get_waitlist(text) from public;
grant execute on function public.crm_get_waitlist(text) to anon;

-- Make PostgREST expose the new function immediately.
notify pgrst, 'reload schema';
