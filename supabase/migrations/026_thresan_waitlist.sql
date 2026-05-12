-- Thresan: Skyflag — physical edition waitlist. Email captures for the
-- pre-Kickstarter announcement. Reads are owner-only (service-role
-- via Supabase dashboard / CSV export at launch time). The 23505
-- unique-violation case is handled silently by the client to avoid
-- a timing attack on which emails are already on the list.

create table if not exists public.thresan_waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text not null default 'web',
  note        text,
  referrer    text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique(email)
);

create index if not exists thresan_waitlist_created_at_idx
  on public.thresan_waitlist (created_at desc);

alter table public.thresan_waitlist enable row level security;

drop policy if exists "anyone can join thresan waitlist" on public.thresan_waitlist;
create policy "anyone can join thresan waitlist"
  on public.thresan_waitlist for insert
  to anon, authenticated
  with check (true);

-- No SELECT / UPDATE / DELETE policies — service-role only reads.
-- At Kickstarter launch, export via Supabase SQL editor:
--   select email from public.thresan_waitlist order by created_at asc;
