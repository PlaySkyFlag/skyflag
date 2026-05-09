-- Pricing scaffolding — three tables that turn future monetization from
-- a re-architecture into a switch-flip.
--
-- Architecture:
--   subscriptions — recurring payment records (one row per active sub).
--   purchases     — one-time payment records (themes, puzzle packs, etc.)
--   entitlements  — what the user can actually use right now. The
--                   denormalized "what to show / what to gate" table
--                   the client reads. Both subscriptions and purchases
--                   write into entitlements via server-side processes
--                   (Stripe webhooks, Apple receipt verification, etc.).
--
-- Why three tables and not just entitlements:
--   - subscriptions and purchases are the audit trail / source of truth
--     from the payment provider. Entitlements are denormalized for
--     fast client-side reads.
--   - Subscription expirations are scheduled events; the renewal
--     webhook updates the existing entitlement's expires_at without
--     re-deriving from anywhere.
--   - One-time purchases never expire but live as their own first-class
--     records; they're not subscriptions in disguise.
--
-- RLS:
--   - Users can READ their own rows in all three tables (so the
--     client can show "Plus active until <date>" or "Theme: owned").
--   - All WRITES go through service-role from Edge Functions
--     (apply-stripe-webhook, verify-apple-receipt, etc.). No client
--     can grant itself an entitlement.

-- ─── subscriptions ─────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  -- Tier identifier — 'plus' / 'premium' / etc. Matches what's
  -- displayed to the user and what entitlements grant.
  tier                     text not null,
  -- 'active' | 'cancelled' | 'expired' | 'past_due' | 'pending'.
  -- Drives whether the matching entitlement should still grant access.
  status                   text not null check (status in ('active', 'cancelled', 'expired', 'past_due', 'pending')),
  -- Where the subscription was purchased — also drives which webhook
  -- handler owns it.
  source                   text not null check (source in ('stripe', 'apple_iap', 'google_iap')),
  -- Provider-side ID (Stripe sub_*, Apple original_transaction_id, etc.).
  -- Unique per source so webhook retries are idempotent.
  source_subscription_id   text not null,
  started_at               timestamptz not null default now(),
  current_period_end       timestamptz,
  cancelled_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (source, source_subscription_id)
);

create index if not exists subscriptions_user_idx
  on public.subscriptions(user_id, status);

-- ─── purchases ─────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  -- 'theme.dune', 'puzzle_pack.001', 'hint_pack.10', etc.
  item_id                  text not null,
  paid_cents               int  not null check (paid_cents >= 0),
  currency                 text not null default 'usd',
  source                   text not null check (source in ('stripe', 'apple_iap', 'google_iap')),
  source_transaction_id    text not null,
  created_at               timestamptz not null default now(),
  unique (source, source_transaction_id)
);

create index if not exists purchases_user_idx
  on public.purchases(user_id, item_id);

-- ─── entitlements ──────────────────────────────────────────────────────
-- The "what does this user actually have" table. Both subscriptions and
-- purchases write rows here. Client reads only this table to gate UI.
create table if not exists public.entitlements (
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- 'feature.advanced_ai' | 'feature.cloud_history' | 'theme.dune' |
  -- 'puzzle_pack.001' | etc. The client checks for these by name.
  entitlement_id   text not null,
  granted_at       timestamptz not null default now(),
  -- null = permanent (one-time purchase). Set for subscription-derived
  -- grants and tracked against current_period_end so the entitlement
  -- expires when the sub does.
  expires_at       timestamptz,
  -- Where this entitlement came from. 'subscription:<sub_id>' or
  -- 'purchase:<purchase_id>' for traceability when revoking.
  source           text not null,
  primary key (user_id, entitlement_id)
);

-- Plain index on (user_id, entitlement_id, expires_at). Partial-index
-- with `where expires_at > now()` would be ideal but Postgres rejects
-- mutable functions in index predicates. has_entitlement does the
-- expiration filter at query time, which is fast enough at our scale.
create index if not exists entitlements_lookup_idx
  on public.entitlements(user_id, entitlement_id, expires_at);

-- ─── Helper: has_entitlement ───────────────────────────────────────────
-- Returns true if the given user currently has the entitlement and it
-- hasn't expired. Use from RLS policies on other tables, e.g.:
--   create policy "paid tournaments require entitlement" on tournaments
--     for insert with check (
--       not is_paid or has_entitlement(auth.uid(), 'tournament.paid_entry')
--     );
create or replace function public.has_entitlement(
  uid uuid,
  ent text
) returns boolean language sql stable as $$
  select exists (
    select 1 from public.entitlements
    where user_id = uid
      and entitlement_id = ent
      and (expires_at is null or expires_at > now())
  );
$$;

-- ─── Auto-update updated_at on subscriptions ───────────────────────────
drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;
alter table public.purchases     enable row level security;
alter table public.entitlements  enable row level security;

drop policy if exists "view own subscriptions" on public.subscriptions;
create policy "view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "view own purchases" on public.purchases;
create policy "view own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

drop policy if exists "view own entitlements" on public.entitlements;
create policy "view own entitlements"
  on public.entitlements for select
  using (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies — writes happen via service-role
-- inside Edge Functions (Stripe webhooks, Apple receipt verification).
-- Clients deliberately cannot grant themselves entitlements.
