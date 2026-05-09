-- Arena tournaments. A tournament is a time-bounded window during which
-- participants accumulate score from finished online MP games against
-- other participants. No separate matchmaking infrastructure — pairing
-- happens via the existing lobby; we only need score tracking here.
--
-- Free vs paid: every tournament has is_paid + entry_fee_cents so a
-- future premium tier can charge to enter. For the beta, all are free
-- (is_paid=false, fee=0).

create table if not exists public.tournaments (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  is_paid         boolean not null default false,
  entry_fee_cents int not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists public.tournament_entries (
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  user_id         uuid not null references auth.users(id)         on delete cascade,
  joined_at       timestamptz not null default now(),
  wins            int not null default 0,
  losses          int not null default 0,
  draws           int not null default 0,
  -- 2 points per win, 1 per draw, 0 per loss. Tiebreakers by raw wins
  -- come from comparing entries.wins on the client.
  score           int not null default 0,
  primary key (tournament_id, user_id)
);

create index if not exists tournament_entries_tournament_idx
  on public.tournament_entries(tournament_id, score desc, wins desc);

-- RLS: anyone can read tournaments + entries (the leaderboard is
-- public). Inserts to entries by the joining user only. Score updates
-- happen via the apply-rating Edge Function (service-role).
alter table public.tournaments       enable row level security;
alter table public.tournament_entries enable row level security;

drop policy if exists "tournaments readable" on public.tournaments;
create policy "tournaments readable"
  on public.tournaments for select using (true);

drop policy if exists "tournament entries readable" on public.tournament_entries;
create policy "tournament entries readable"
  on public.tournament_entries for select using (true);

drop policy if exists "users can join tournaments" on public.tournament_entries;
create policy "users can join tournaments"
  on public.tournament_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can leave own entry" on public.tournament_entries;
create policy "users can leave own entry"
  on public.tournament_entries for delete
  using (auth.uid() = user_id);

-- Seed one open arena so the panel has something to show on day one.
insert into public.tournaments (name, description, starts_at, ends_at, is_paid)
values (
  'SkyFlag Beta Arena #1',
  'First open arena — free entry, 7 days. Win games against other entrants to climb the leaderboard.',
  now(),
  now() + interval '7 days',
  false
)
on conflict do nothing;
