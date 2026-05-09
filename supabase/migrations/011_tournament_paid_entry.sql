-- Tournament-entry policy hardening — closes the security finding from
-- the audit: previously ANY authenticated user could insert a row in
-- tournament_entries for ANY tournament, including paid ones, with no
-- check on whether they'd actually paid. Latent today (no paid
-- tournaments exist), but the moment one is added, anyone can free-ride.
--
-- Fix: insert is gated on either (a) the tournament being free, OR
-- (b) the user holding the 'tournament.paid_entry' entitlement that
-- a future payment Edge Function will grant after charging them.
--
-- has_entitlement is the helper added in migration 010 — handles the
-- expiration check transparently.

drop policy if exists "users can join tournaments" on public.tournament_entries;
create policy "users can join tournaments"
  on public.tournament_entries for insert
  with check (
    auth.uid() = user_id
    and (
      -- Free tournaments are open to anyone signed in.
      coalesce(
        (select is_paid from public.tournaments where id = tournament_id),
        true
      ) = false
      -- Paid tournaments require the entitlement.
      or public.has_entitlement(auth.uid(), 'tournament.paid_entry')
    )
  );
