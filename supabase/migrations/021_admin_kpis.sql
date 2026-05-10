-- Admin reporting infrastructure.
--
-- Two pieces:
--   1. is_admin(uid) — security-definer boolean, true iff the user
--      owns the project-owner email. Centralized so any future
--      admin-only RLS or function can call this rather than
--      duplicating the email check.
--   2. kpi_snapshot() — single JSON blob containing every KPI the
--      weekly report needs. Cumulative + last-7-days + previous-7-days
--      so the report can render deltas. Refuses non-admin callers.
--
-- KPIs in the snapshot are split into Acquisition / Engagement /
-- Monetization / Network buckets so the email template can group
-- them visually. Each metric has cumulative ("total") and weekly
-- ("week", "prev_week") fields where that's meaningful — the
-- prev_week field lets the report compute week-over-week deltas
-- without a second query.
--
-- Server-side caveat: only ONLINE multiplayer games are visible
-- here (game_results is populated by apply-rating; 1P / 2P hot-seat
-- live in localStorage). For total-game tracking that includes
-- local games, a future migration would need a server-reported
-- counter. For now this is the source of truth for paid-relevant
-- engagement.

-- ─── Admin gating ─────────────────────────────────────────────────
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = auth, public
stable
as $$
  select exists (
    select 1
    from auth.users
    where id = uid
      and email = 'njatel@limnology.ca'
      and email_confirmed_at is not null
  )
$$;

-- Both anon (for the future signed-out admin-route check) and
-- authenticated need to be able to invoke. The function itself
-- only returns true for the actual admin, so granting widely is
-- safe.
grant execute on function public.is_admin(uuid) to anon, authenticated;

-- ─── KPI snapshot ─────────────────────────────────────────────────
create or replace function public.kpi_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = auth, public
stable
as $$
declare
  result jsonb;
  cutoff_week  timestamptz := now() - interval '7 days';
  cutoff_prev  timestamptz := now() - interval '14 days';
  cutoff_30d   timestamptz := now() - interval '30 days';
begin
  -- Authorization gate — security-definer functions need their own
  -- check or anyone could grant-execute themselves a backdoor.
  if not public.is_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  with
  -- Acquisition: who's signing up and how
  acq as (
    select
      count(*)                                                              as total_users,
      count(*) filter (where email is not null)                             as total_with_email,
      count(*) filter (where email is null)                                 as total_anon,
      count(*) filter (where email_confirmed_at is not null)                as total_verified,
      count(*) filter (where created_at >= cutoff_week)                     as new_users_week,
      count(*) filter (where created_at >= cutoff_prev
                          and created_at <  cutoff_week)                    as new_users_prev_week,
      count(*) filter (where created_at >= cutoff_week
                          and email is not null)                            as new_with_email_week,
      count(*) filter (where created_at >= cutoff_30d)                      as new_users_30d
    from auth.users
  ),

  -- Engagement: are users coming back, are they playing
  -- WAU / DAU derived from auth.sessions.updated_at — touches every
  -- time the SDK refreshes the access token, so reasonably proxies
  -- "active in browser this period". Game-based active counts are
  -- separate (engaged enough to actually finish a game).
  sess as (
    select
      count(distinct user_id) filter (where updated_at >= cutoff_week)      as wau,
      count(distinct user_id) filter (where updated_at >= now() - interval '1 day')  as dau,
      count(distinct user_id) filter (where updated_at >= cutoff_30d)       as mau
    from auth.sessions
  ),
  games as (
    select
      count(*)                                                              as total_mp_games,
      count(*) filter (where created_at >= cutoff_week)                     as new_games_week,
      count(*) filter (where created_at >= cutoff_prev
                          and created_at <  cutoff_week)                    as new_games_prev_week,
      count(*) filter (where created_at >= cutoff_30d)                      as new_games_30d,
      count(*) filter (where is_draw)                                       as total_draws,
      count(distinct winner_user_id) filter (where created_at >= cutoff_week)
                                                                            as distinct_winners_week,
      count(distinct coalesce(winner_user_id, loser_user_id))
        filter (where created_at >= cutoff_week)                            as game_active_users_week
    from public.game_results
  ),
  rooms as (
    -- Started-but-not-finished rooms tell us about MP funnel health.
    -- A high "started" with low "finished" suggests matchmaking /
    -- desync issues that ought to be investigated.
    select
      count(*) filter (where created_at >= cutoff_week)                     as rooms_created_week,
      count(*) filter (where created_at >= cutoff_week
                          and p2_id is not null)                            as rooms_paired_week
    from public.games
  ),

  -- Monetization
  mon as (
    select
      count(*) filter (where is_plus)                                       as plus_total,
      count(*) filter (where is_plus
                          and updated_at >= cutoff_week)                    as plus_changed_week
    from public.profiles
  ),
  ent as (
    select
      count(*) filter (where created_at >= cutoff_week
                          and entitlement_id = 'feature.plus')              as new_plus_week,
      count(*) filter (where created_at >= cutoff_prev
                          and created_at <  cutoff_week
                          and entitlement_id = 'feature.plus')              as new_plus_prev_week
    from public.entitlements
  ),

  -- Network: virality / community signals
  fr as (
    select
      count(*)                                                              as total_friendships,
      count(*) filter (where status = 'accepted')                           as accepted_friendships,
      count(*) filter (where created_at >= cutoff_week)                     as new_friendships_week
    from public.friendships
  ),
  tn as (
    select
      count(*)                                                              as total_tournaments,
      count(*) filter (where cancelled_at is null
                          and starts_at <= now()
                          and ends_at   >  now())                           as active_tournaments,
      count(*) filter (where created_at >= cutoff_week)                     as new_tournaments_week,
      count(*) filter (where created_by is not null)                        as user_created_tournaments
    from public.tournaments
  ),
  te as (
    select
      count(*)                                                              as total_entries,
      count(*) filter (where joined_at >= cutoff_week)                      as new_entries_week
    from public.tournament_entries
  ),

  -- Push-notification surface — only meaningful once people opt in.
  push_subs as (
    select
      count(*)                                                              as total_push_subs,
      count(*) filter (where platform = 'web')                              as push_web,
      count(*) filter (where platform = 'ios')                              as push_ios
    from public.push_subscriptions
  )

  select jsonb_build_object(
    'generated_at', now(),
    'period', jsonb_build_object(
      'window_start', cutoff_week,
      'window_end',   now(),
      'days',         7
    ),
    'acquisition', jsonb_build_object(
      'total_users',           acq.total_users,
      'total_with_email',      acq.total_with_email,
      'total_anon',            acq.total_anon,
      'total_verified',        acq.total_verified,
      'new_users_week',        acq.new_users_week,
      'new_users_prev_week',   acq.new_users_prev_week,
      'new_with_email_week',   acq.new_with_email_week,
      'new_users_30d',         acq.new_users_30d
    ),
    'engagement', jsonb_build_object(
      'dau',                   sess.dau,
      'wau',                   sess.wau,
      'mau',                   sess.mau,
      'total_mp_games',        games.total_mp_games,
      'new_games_week',        games.new_games_week,
      'new_games_prev_week',   games.new_games_prev_week,
      'new_games_30d',         games.new_games_30d,
      'total_draws',           games.total_draws,
      'game_active_users_week', games.game_active_users_week,
      'rooms_created_week',    rooms.rooms_created_week,
      'rooms_paired_week',     rooms.rooms_paired_week
    ),
    'monetization', jsonb_build_object(
      'plus_total',            mon.plus_total,
      'plus_changed_week',     mon.plus_changed_week,
      'new_plus_week',         ent.new_plus_week,
      'new_plus_prev_week',    ent.new_plus_prev_week
    ),
    'network', jsonb_build_object(
      'total_friendships',           fr.total_friendships,
      'accepted_friendships',        fr.accepted_friendships,
      'new_friendships_week',        fr.new_friendships_week,
      'total_tournaments',           tn.total_tournaments,
      'active_tournaments',          tn.active_tournaments,
      'new_tournaments_week',        tn.new_tournaments_week,
      'user_created_tournaments',    tn.user_created_tournaments,
      'total_tournament_entries',    te.total_entries,
      'new_tournament_entries_week', te.new_entries_week,
      'total_push_subs',             push_subs.total_push_subs,
      'push_web',                    push_subs.push_web,
      'push_ios',                    push_subs.push_ios
    )
  )
  into result
  from acq, sess, games, rooms, mon, ent, fr, tn, te, push_subs;

  return result;
end;
$$;

grant execute on function public.kpi_snapshot() to authenticated;
