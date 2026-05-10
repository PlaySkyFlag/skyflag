-- Denormalized is_plus flag on profiles. Lets anyone reading a profile
-- row (leaderboards, friends, chat) see whether the player is a Plus
-- subscriber without having to join entitlements — which is gated to
-- self-reads only.
--
-- Privacy: Plus status is intentionally public — the badge is the
-- whole point. Users opt into broadcasting it by subscribing.
--
-- Authoritative source remains public.entitlements. The stripe-webhook
-- Edge Function writes to both is_plus AND entitlements when a
-- subscription transitions. This column is a read-optimized mirror.

alter table public.profiles
  add column if not exists is_plus boolean not null default false;

-- Backfill from existing entitlements so users who are already Plus
-- show the badge on the first deploy without waiting for a webhook.
update public.profiles p
set is_plus = true
where exists (
  select 1 from public.entitlements e
  where e.user_id = p.id
    and e.entitlement_id = 'feature.plus'
    and (e.expires_at is null or e.expires_at > now())
);

-- Helpful index for "list all Plus users" admin queries; harmless on a
-- mostly-false column thanks to the partial WHERE.
create index if not exists profiles_is_plus_idx
  on public.profiles (id) where is_plus = true;
