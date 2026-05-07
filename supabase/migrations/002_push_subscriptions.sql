-- Web Push subscriptions — one row per user. Updated whenever the user
-- enables/refreshes push (the browser may rotate endpoint keys silently),
-- so we upsert by user_id.

create table if not exists public.push_subscriptions (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists push_subs_touch on public.push_subscriptions;
create trigger push_subs_touch
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "users manage own push sub" on public.push_subscriptions;
create policy "users manage own push sub"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The Edge Function reads other users' rows via the service-role key
-- (which bypasses RLS), so no public read policy is needed.
