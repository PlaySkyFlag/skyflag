-- Two account-resilience features in one migration.
--
-- 1. Avatars
-- 2. Recovery codes — one-shot codes for account recovery when the
--    user has lost access to their primary auth method (email, OAuth).

-- ── 1. Avatars ───────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text;

-- Storage bucket for avatars. Public-read (anyone can fetch any user's
-- avatar — they're displayed on leaderboards, in chat, etc.). Writes
-- gated by RLS so each user can only manage their own avatar.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage RLS — file path convention is `<user_id>.<ext>` so the path
-- prefix itself encodes ownership. Compare auth.uid()::text against
-- the path-without-extension to authorize writes.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );

-- ── 2. Recovery codes ────────────────────────────────────────────────
-- One-shot codes that let a user re-authenticate when they've lost
-- access to email. Stored as SHA-256 hashes — the plaintext is shown
-- to the user ONCE at generation time and never persisted. 8 codes
-- per user; each is single-use.
create table if not exists public.recovery_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  code_hash   text not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists recovery_codes_user_idx
  on public.recovery_codes (user_id);
-- Used for the validate-and-mark lookup. Filtering on used_at IS NULL
-- keeps the index hot only for unused codes.
create index if not exists recovery_codes_hash_idx
  on public.recovery_codes (code_hash) where used_at is null;

alter table public.recovery_codes enable row level security;

-- The user can SEE that they have codes (count, used_at status) but
-- never the hash itself. Generation and validation happen exclusively
-- through Edge Functions with the service-role key.
drop policy if exists "users can see own recovery codes" on public.recovery_codes;
create policy "users can see own recovery codes"
  on public.recovery_codes for select
  using (auth.uid() = user_id);
