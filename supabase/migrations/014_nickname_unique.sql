-- Enforce nickname uniqueness on profiles. Case-insensitive — "Raven"
-- and "raven" should collide. Resilience win: leaderboards stop
-- showing ambiguous duplicates; lobby invites resolve unambiguously.
--
-- Dedupe pass first: if any duplicates already exist in production, the
-- unique index creation would fail. Append a 4-char id suffix to all
-- but the earliest-created row in each duplicate group, then add the
-- index. Idempotent — re-running on an already-clean table is a no-op.

update public.profiles p
set nickname = p.nickname || '_' || substring(p.id::text from 1 for 4)
where exists (
  select 1 from public.profiles p2
  where lower(p2.nickname) = lower(p.nickname)
    and p2.created_at < p.created_at
);

create unique index if not exists profiles_nickname_lower_idx
  on public.profiles (lower(nickname));
