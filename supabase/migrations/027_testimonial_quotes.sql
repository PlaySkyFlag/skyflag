-- Testimonial capture system. Pre-Kickstarter, every play session that
-- yields a quotable reaction is social proof we can put back into the
-- funnel: landing-page hero rotation, reviewer outreach, Reddit / BGG
-- posts. Without this, plays produce isolated experiences and no
-- transferable evidence.
--
-- Pipeline:
--   1. Anonymous INSERT from the post-game flow (anyone can submit).
--   2. Admin (njatel@limnology.ca via public.is_admin()) curates —
--      sets approved/featured/reject.
--   3. Public SELECT only on approved+featured+consented rows for the
--      Landing hero. Everything else stays admin-only.
--
-- Quotes without explicit consent_to_share=true are private feedback
-- and will never be rendered publicly even if approved/featured —
-- the row policy enforces all three flags together.

create table if not exists public.quotes (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  quote             text not null check (length(trim(quote)) > 0),
  name              text,
  city              text,
  email             text,
  consent_to_share  boolean not null default false,
  approved          boolean not null default false,
  featured          boolean not null default false,
  user_id           uuid references auth.users(id) on delete set null,
  source            text not null default 'postgame',
  referrer          text,
  user_agent        text,
  -- Game context — helps curate (a quote from someone who lost to
  -- Expert reads differently than one from a hot-seat winner).
  game_outcome      text,
  difficulty        text
);

create index if not exists quotes_created_at_idx
  on public.quotes (created_at desc);
create index if not exists quotes_featured_approved_idx
  on public.quotes (featured, approved)
  where featured and approved and consent_to_share;

alter table public.quotes enable row level security;

-- INSERT: anyone may submit a quote. Same anti-timing pattern as
-- thresan_waitlist — we don't probe the row back so duplicate detection
-- is silent.
drop policy if exists "anyone can submit a quote" on public.quotes;
create policy "anyone can submit a quote"
  on public.quotes for insert
  to anon, authenticated
  with check (true);

-- SELECT (public): only quotes that have cleared all three gates —
-- approved by admin, featured for surfacing, and explicitly consented
-- to by the submitter. Used by the Landing hero rotation.
drop policy if exists "public can read featured quotes" on public.quotes;
create policy "public can read featured quotes"
  on public.quotes for select
  to anon, authenticated
  using (approved and featured and consent_to_share);

-- SELECT (admin): admin can read all quotes regardless of state, for
-- the /admin/quotes curation surface.
drop policy if exists "admin can read all quotes" on public.quotes;
create policy "admin can read all quotes"
  on public.quotes for select
  to authenticated
  using (public.is_admin());

-- UPDATE: admin only. Curation flips approved/featured.
drop policy if exists "admin can update quotes" on public.quotes;
create policy "admin can update quotes"
  on public.quotes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: admin only. Hard delete for rejections / spam.
drop policy if exists "admin can delete quotes" on public.quotes;
create policy "admin can delete quotes"
  on public.quotes for delete
  to authenticated
  using (public.is_admin());
