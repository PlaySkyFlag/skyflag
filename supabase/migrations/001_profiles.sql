-- 3phor user profiles. Each row is 1:1 with an auth.users row, populated
-- the first time a signed-in user completes the new-account form. RLS lets
-- anyone read profiles (so opponents can see each other's nicknames) but
-- only the owner can write their own row.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 2 and 24),
  full_name   text,
  age         int  check (age is null or age between 1 and 120),
  gender      text check (gender is null or gender in ('female','male','non-binary','other','prefer-not-to-say')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Maintain updated_at on row updates.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Row-level security.
alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by anyone" on public.profiles;
create policy "profiles are viewable by anyone"
  on public.profiles for select
  using (true);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "users can delete own profile" on public.profiles;
create policy "users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);
