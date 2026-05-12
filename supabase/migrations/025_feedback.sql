-- In-app feedback inbox. Testers can submit bug reports, confusion
-- moments, feature ideas, or praise from anywhere in the app. The form
-- auto-captures current URL, user-agent, and viewport so the owner
-- doesn't have to ask "what page were you on?" follow-ups.
--
-- Reads are owner-only (service-role through the Supabase dashboard).
-- Testers cannot see other testers' feedback — keeps the inbox clean
-- and reduces the social pressure that suppresses honest feedback.
--
-- user_id is NULLABLE so feedback works for fully-signed-out users
-- too: a tester who hits a sign-in bug can still tell us about it.

create table if not exists public.feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  category        text not null check (category in ('bug', 'confusion', 'feature', 'praise', 'other')),
  message         text not null,
  current_url     text,
  user_agent      text,
  viewport_width  int,
  viewport_height int,
  created_at      timestamptz not null default now(),
  -- Owner-only fields for triage. Never read or written by clients.
  resolved_at     timestamptz,
  resolved_notes  text
);

-- Index for the owner's read path: "newest first, unresolved on top".
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

create index if not exists feedback_unresolved_idx
  on public.feedback (created_at desc)
  where resolved_at is null;

alter table public.feedback enable row level security;

-- Insert: anyone can submit. If signed in, user_id MUST match auth.uid()
-- so a malicious client can't impersonate another user's id on a
-- submission. If signed out, user_id MUST be null (can't fake an id
-- belonging to someone else either).
drop policy if exists "feedback insertable by anyone" on public.feedback;
create policy "feedback insertable by anyone"
  on public.feedback for insert
  with check (
    (auth.uid() is null and user_id is null)
    or (auth.uid() is not null and auth.uid() = user_id)
  );

-- No SELECT / UPDATE / DELETE policies — that means clients can't read,
-- update, or delete feedback. Only the service role (the owner via
-- Supabase dashboard or admin tooling) can see and triage the inbox.
-- Keeps tester reports honest by removing visibility pressure.
