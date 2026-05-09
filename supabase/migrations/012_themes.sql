-- Database-driven themes — turns "ship a new paid theme" from a code
-- deploy into a single-row INSERT (or SQL Editor entry).
--
-- The existing in-code THEMES record (src/game/themes.ts) stays as the
-- baseline / free defaults. DB rows augment that set: any theme added
-- here becomes available to clients, and `requires_entitlement` lets
-- premium themes auto-gate against the entitlements table from migration
-- 010 without any client-side knowledge of payments.
--
-- Schema notes:
--   - id is text (e.g. 'classic', 'dune', 'noir') so links and
--     persistence are stable; surrogate uuids would just add a layer.
--   - layers_json holds the same shape the client's BoardTheme already
--     consumes — no per-layer columns to keep flexibility.
--   - is_active gates visibility without deleting; useful when retiring
--     a theme without breaking saved game references to it.
--   - sort_order controls list order in the picker.

create table if not exists public.themes (
  id                    text primary key,
  name                  text not null,
  -- Per-layer BoardTheme entries keyed by layer ('ground', 'sky', 'space').
  -- Shape mirrors the in-code THEMES[id].layers structure so the loader
  -- can drop these straight into the same Map the rest of the app uses.
  layers_json           jsonb not null,
  -- Nullable. When set, only users with this entitlement can select
  -- the theme. Free themes leave it null.
  -- Examples: 'theme.dune', 'theme.bundle.season1'
  requires_entitlement  text,
  -- Active themes are returned by the loader; inactive ones stay in
  -- the table for historical reference / saved-game compatibility but
  -- aren't shown in pickers.
  is_active             boolean not null default true,
  sort_order            int not null default 100,
  created_at            timestamptz not null default now()
);

create index if not exists themes_active_idx
  on public.themes(is_active, sort_order);

-- RLS: anyone can read active themes (so the picker works for guests
-- and free users). Writes only via service-role inside Edge Functions
-- or directly in the SQL Editor — clients can't add or modify themes.
alter table public.themes enable row level security;

drop policy if exists "themes readable" on public.themes;
create policy "themes readable"
  on public.themes for select
  using (is_active = true);
