-- Friendships — symmetric, accept-based. Canonical ordering (smaller
-- uuid in user_a_id) means there's only ever one row per pair, so the
-- "are A and B friends?" check is a single primary-key lookup. The
-- initiator column distinguishes who sent the original request, so
-- the OTHER side is the one who can accept.

create table if not exists public.friendships (
  user_a_id     uuid not null references auth.users(id) on delete cascade,
  user_b_id     uuid not null references auth.users(id) on delete cascade,
  initiator_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  check (user_a_id < user_b_id)
);

create index if not exists friendships_user_a_idx on public.friendships(user_a_id, status);
create index if not exists friendships_user_b_idx on public.friendships(user_b_id, status);

alter table public.friendships enable row level security;

-- Each user can read rows where they're either side of the relationship.
drop policy if exists "view own friendships" on public.friendships;
create policy "view own friendships"
  on public.friendships for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- Insert: only the initiator can create the row, and they must be one
-- of the two users involved. Status must start as 'pending'.
drop policy if exists "create friend request" on public.friendships;
create policy "create friend request"
  on public.friendships for insert
  with check (
    auth.uid() = initiator_id
    and (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and status = 'pending'
  );

-- Update: only the recipient (NOT the initiator) of a pending request
-- can flip the status, and only to 'accepted'.
drop policy if exists "accept friend request" on public.friendships;
create policy "accept friend request"
  on public.friendships for update
  using (
    status = 'pending'
    and auth.uid() <> initiator_id
    and (auth.uid() = user_a_id or auth.uid() = user_b_id)
  )
  with check (status = 'accepted');

-- Delete: either side can unfriend / decline at any time.
drop policy if exists "remove friendship" on public.friendships;
create policy "remove friendship"
  on public.friendships for delete
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);
