-- 035: CRM contact mirror + Kickstarter follower log.
--
-- These two tables are a ONE-DIRECTIONAL, DERIVED mirror. The master copy
-- lives in the thresan-crm repo as version-controlled CSVs
-- (data/contacts.csv, data/ks_follower_counts.csv). A push script
-- (thresan-crm/scripts/push_to_supabase.R) TRUNCATEs + re-INSERTs these
-- tables in one transaction so the DB exactly equals the CSV after every
-- run. NEVER hand-edit these tables — edits are overwritten on the next push.
--
-- Why mirror at all: lets curated contacts (reviewers/personal/press) and the
-- follower KPI be queried alongside thresan_waitlist subscribers in one place.
-- Master stays the CSV (git = backup + history), so this is safe to rebuild.
--
-- Reads use the SAME token-gated, least-privilege pattern as 034
-- (crm_get_waitlist): anon key + crm_read_token (Vault). No SELECT policy on
-- the tables; writes arrive via the authed CLI / service path only.

create table if not exists public.thresan_contacts (
  id           uuid primary key default gen_random_uuid(),
  type         text not null default 'reviewer',  -- reviewer | personal | press | backer
  priority     text,
  name         text not null,
  channel      text,
  platform     text,
  segment      text,
  audience     text,
  contact      text,
  status       text,
  last_contact date,
  notes        text,
  synced_at    timestamptz not null default now()
);
create index if not exists thresan_contacts_type_idx on public.thresan_contacts (type);

create table if not exists public.ks_follower_counts (
  id          uuid primary key default gen_random_uuid(),
  count_date  date not null,
  followers   integer not null,
  note        text,
  synced_at   timestamptz not null default now()
);
create index if not exists ks_follower_counts_date_idx on public.ks_follower_counts (count_date);

alter table public.thresan_contacts  enable row level security;
alter table public.ks_follower_counts enable row level security;
-- No anon insert/select/update/delete policies: the CSV-mastered push writes
-- via the authed CLI (Management API), and reads go through the RPCs below.

-- ── Token-gated read RPCs (mirror 034's crm_get_waitlist) ─────────────────
create or replace function public.crm_get_contacts(p_token text)
returns setof public.thresan_contacts
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
  return query select * from public.thresan_contacts order by type, priority, name;
end;
$$;

create or replace function public.crm_get_follower_counts(p_token text)
returns setof public.ks_follower_counts
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
  return query select * from public.ks_follower_counts order by count_date;
end;
$$;

revoke all on function public.crm_get_contacts(text)        from public;
revoke all on function public.crm_get_follower_counts(text) from public;
grant execute on function public.crm_get_contacts(text)        to anon;
grant execute on function public.crm_get_follower_counts(text) to anon;

notify pgrst, 'reload schema';
