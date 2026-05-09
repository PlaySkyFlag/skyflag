-- RLS for the public.games table. The table itself was created in the
-- Supabase dashboard before we used migrations, with permissive policies
-- intended for the MVP. As we layered auth/profile/ratings on top, those
-- policies fell out of step — the symptom was "new row violates RLS"
-- (42501) when a signed-in user clicked Create room.
--
-- Both sides cast to text so this works whether p1_id/p2_id are stored
-- as text (legacy) or uuid.

alter table public.games enable row level security;

-- SELECT — readable by either participant. Rooms with no p2 yet are
-- also readable by everyone signed in so a recipient can look up the
-- code and join.
drop policy if exists "games select participants" on public.games;
create policy "games select participants"
  on public.games for select
  using (
    auth.uid()::text = p1_id::text
    or auth.uid()::text = p2_id::text
    or p2_id is null
  );

-- INSERT — only the challenger creates the row, and only as p1 (so they
-- can't post a row claiming someone else opened it).
drop policy if exists "games insert as p1" on public.games;
create policy "games insert as p1"
  on public.games for insert
  with check (auth.uid()::text = p1_id::text);

-- UPDATE — either participant updates state (move sync). Rooms with no
-- p2 yet are also updatable so the recipient can fill in p2_id when
-- they accept a challenge or join by code.
drop policy if exists "games update participants" on public.games;
create policy "games update participants"
  on public.games for update
  using (
    auth.uid()::text = p1_id::text
    or auth.uid()::text = p2_id::text
    or p2_id is null
  );

-- DELETE — either side can tear down a room (cancel a challenge,
-- decline an incoming, or leave a finished game).
drop policy if exists "games delete participants" on public.games;
create policy "games delete participants"
  on public.games for delete
  using (
    auth.uid()::text = p1_id::text
    or auth.uid()::text = p2_id::text
  );
