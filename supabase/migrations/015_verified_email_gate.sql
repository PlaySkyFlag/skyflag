-- Verified-email gate for rated / tournament play.
--
-- Anyone can still play (solo, hot-seat, online MP unrated). The gate
-- applies to:
--   * Joining tournaments — enforced here via the INSERT policy
--   * Receiving rating updates from finished MP games — enforced in
--     the apply-rating Edge Function (which calls this helper)
--
-- Why a helper function: RLS policies can't reach into the auth schema
-- directly without a security-definer escape hatch. The helper runs
-- with elevated privileges, returns a boolean, and is safe to call
-- from any policy or Edge Function.

create or replace function public.has_verified_email(uid uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select coalesce(
    (select email_confirmed_at is not null
     from auth.users
     where id = uid),
    false
  )
$$;

-- Permit anon / authenticated roles to invoke the helper. The function
-- runs as security definer so the caller's normal grants on auth.users
-- don't matter — only execute on this function does.
grant execute on function public.has_verified_email(uuid) to anon, authenticated;

-- Update tournament_entries INSERT policy: require verified email on
-- top of the existing free / paid-entitlement check from migration 011.
drop policy if exists "users can join tournaments" on public.tournament_entries;
create policy "users can join tournaments"
  on public.tournament_entries for insert
  with check (
    auth.uid() = user_id
    and public.has_verified_email(auth.uid())
    and (
      coalesce(
        (select is_paid from public.tournaments where id = tournament_id),
        true
      ) = false
      or public.has_entitlement(auth.uid(), 'tournament.paid_entry')
    )
  );
