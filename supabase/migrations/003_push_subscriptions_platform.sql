-- Extend push_subscriptions to support iOS device tokens alongside Web
-- Push subscriptions. A single user can be subscribed on multiple
-- platforms simultaneously (e.g., Mac browser + iPhone TestFlight),
-- so the primary key becomes (user_id, platform).

alter table public.push_subscriptions
  drop constraint push_subscriptions_pkey;

alter table public.push_subscriptions
  add column if not exists platform text not null default 'web'
    check (platform in ('web','ios')),
  add column if not exists apns_token text;

-- Web fields are no longer required (iOS rows leave them null and just
-- use apns_token instead).
alter table public.push_subscriptions
  alter column endpoint drop not null,
  alter column p256dh   drop not null,
  alter column auth     drop not null;

-- Composite primary key: one row per (user, platform).
alter table public.push_subscriptions
  add constraint push_subscriptions_pkey primary key (user_id, platform);

-- A row is valid only if the right keys are present for its platform.
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_keys_match_platform;
alter table public.push_subscriptions
  add constraint push_subscriptions_keys_match_platform
  check (
    (platform = 'web' and endpoint is not null and p256dh is not null and auth is not null)
    or
    (platform = 'ios' and apns_token is not null)
  );
