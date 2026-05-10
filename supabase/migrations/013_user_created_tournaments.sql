-- Phase 1 — Allow any signed-in user to create their own FREE tournament.
--
-- Paid tournaments stay locked behind is_paid + entry_fee_cents columns
-- which remain false/0 in Phase 1. Phase 2 will add Stripe payment + a
-- second policy permitting is_paid=true creation by Plus subscribers,
-- gated on a Canadian gaming-law / Stripe-approval review.
--
-- Caps to prevent spam and keep things sensible:
--   * 1 active (non-cancelled, non-ended) tournament per creator
--   * Duration between 1 day and 30 days
--   * Start within "now-ish" through 30 days out

alter table public.tournaments
  add column if not exists created_by   uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_at timestamptz;

create index if not exists tournaments_created_by_idx
  on public.tournaments(created_by) where created_by is not null;

-- INSERT — any signed-in user can create a free tournament subject to caps.
-- The subquery enforces "max 1 active per creator" by counting existing
-- non-cancelled, non-ended tournaments owned by the inserting user
-- before this row is added.
drop policy if exists "users can create tournaments" on public.tournaments;
create policy "users can create tournaments"
  on public.tournaments for insert
  with check (
    auth.uid() = created_by
    and is_paid = false
    and entry_fee_cents = 0
    and ends_at > starts_at
    and ends_at - starts_at <= interval '30 days'
    and ends_at - starts_at >= interval '1 day'
    and starts_at >= now() - interval '1 hour'
    and starts_at <= now() + interval '30 days'
    and char_length(coalesce(name, '')) between 3 and 60
    and char_length(coalesce(description, '')) <= 500
    and (
      select count(*) from public.tournaments
      where created_by = auth.uid()
      and cancelled_at is null
      and ends_at > now()
    ) = 0
  );

-- UPDATE — creator can edit their own tournament. WITH CHECK keeps
-- is_paid / entry_fee_cents pinned to free in Phase 1; an update can't
-- escalate a free tournament into a paid one by mutating those fields.
-- Cancellation is just `update set cancelled_at = now()`.
drop policy if exists "creator can update own tournament" on public.tournaments;
create policy "creator can update own tournament"
  on public.tournaments for update
  using (auth.uid() = created_by)
  with check (
    auth.uid() = created_by
    and is_paid = false
    and entry_fee_cents = 0
  );

-- DELETE — creator can delete their tournament only if nobody has joined.
-- After entries exist, the tournament becomes shared state and must be
-- cancelled (cancelled_at), not deleted, so the leaderboard isn't lost.
drop policy if exists "creator can delete empty tournament" on public.tournaments;
create policy "creator can delete empty tournament"
  on public.tournaments for delete
  using (
    auth.uid() = created_by
    and not exists (
      select 1 from public.tournament_entries
      where tournament_id = tournaments.id
    )
  );
