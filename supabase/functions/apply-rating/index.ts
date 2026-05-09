// Supabase Edge Function — applies the ELO rating update for a finished
// online multiplayer game. Both players' clients can call this; the
// game_results PRIMARY KEY on room_code makes the second call a no-op
// (PostgreSQL rejects the duplicate insert), so the ratings update at
// most once per game.
//
// Request body: { room_code }
// The function reads the authoritative game state from public.games to
// determine winner/loser/draw and the players involved — clients can't
// fake the outcome.
//
// Deployment:
//   supabase functions deploy apply-rating --no-verify-jwt
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.

// @ts-expect-error — Deno-only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-expect-error — Deno-only globals.
const env = (k: string): string | undefined => Deno.env.get(k);
const SUPABASE_URL = env('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') as string;
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY') as string;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Standard chess K-factor. 32 is appropriate for under-2400 / casual
// play; serious sites taper this down with more games but for a small
// player base 32 keeps ratings responsive.
const K_FACTOR = 32;

// Standard ELO expected-score formula. Returns the probability that
// player A beats player B given their rating difference.
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-expect-error — Deno-only.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  // Auth check: caller must be signed in.
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ ok: false, error: 'unauthorized' }, 401);
  const callerSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller } = await callerSb.auth.getUser();
  if (!caller?.user) return json({ ok: false, error: 'unauthorized' }, 401);

  let body: { room_code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'bad-json' }, 400);
  }
  const room_code = body.room_code;
  if (!room_code) return json({ ok: false, error: 'missing-room-code' }, 400);

  // Read the authoritative game state.
  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('p1_id, p2_id, state')
    .eq('room_code', room_code)
    .maybeSingle();
  if (gameErr) return json({ ok: false, error: gameErr.message }, 500);
  if (!game) return json({ ok: false, error: 'room-not-found' }, 404);
  if (!game.p1_id || !game.p2_id) return json({ ok: true, reason: 'incomplete-game' });

  // Caller must be one of the players.
  if (caller.user.id !== game.p1_id && caller.user.id !== game.p2_id) {
    return json({ ok: false, error: 'not-a-participant' }, 403);
  }

  const status = (game.state as { status?: { kind?: string; winner?: string } })?.status;
  if (!status || status.kind === 'in-progress') {
    return json({ ok: true, reason: 'game-not-finished' });
  }
  const isDraw = status.kind === 'draw';
  const winnerSlot = status.kind === 'won' ? status.winner : null;

  let winnerId: string;
  let loserId: string;
  if (isDraw) {
    // For draws, treat p1 as the "winner slot" arbitrarily; ELO is
    // symmetric for draws so this only affects column naming.
    winnerId = game.p1_id;
    loserId = game.p2_id;
  } else if (winnerSlot === 'p1') {
    winnerId = game.p1_id;
    loserId = game.p2_id;
  } else if (winnerSlot === 'p2') {
    winnerId = game.p2_id;
    loserId = game.p1_id;
  } else {
    return json({ ok: false, error: 'no-winner-info' }, 400);
  }

  // Idempotency: if game_results already has a row for this room, the
  // ratings have been applied. Return early without doing it again.
  const { data: existing } = await supabase
    .from('game_results')
    .select('room_code')
    .eq('room_code', room_code)
    .maybeSingle();
  if (existing) return json({ ok: true, reason: 'already-applied' });

  // Fetch current ratings for both players.
  const { data: profs, error: profsErr } = await supabase
    .from('profiles')
    .select('id, rating, games_played')
    .in('id', [winnerId, loserId]);
  if (profsErr) return json({ ok: false, error: profsErr.message }, 500);
  if (!profs || profs.length !== 2) return json({ ok: false, error: 'profile-missing' }, 500);

  const winProf = profs.find((p) => p.id === winnerId)!;
  const losProf = profs.find((p) => p.id === loserId)!;
  const winBefore = winProf.rating ?? 1200;
  const losBefore = losProf.rating ?? 1200;

  // Compute new ratings.
  const winExpected = expectedScore(winBefore, losBefore);
  const losExpected = 1 - winExpected;
  const winActual = isDraw ? 0.5 : 1;
  const losActual = isDraw ? 0.5 : 0;
  const winAfter = Math.round(winBefore + K_FACTOR * (winActual - winExpected));
  const losAfter = Math.round(losBefore + K_FACTOR * (losActual - losExpected));

  // Apply via service role (bypasses RLS that limits each user to their
  // own profile).
  const { error: updWinErr } = await supabase
    .from('profiles')
    .update({ rating: winAfter, games_played: (winProf.games_played ?? 0) + 1 })
    .eq('id', winnerId);
  if (updWinErr) return json({ ok: false, error: updWinErr.message }, 500);
  const { error: updLosErr } = await supabase
    .from('profiles')
    .update({ rating: losAfter, games_played: (losProf.games_played ?? 0) + 1 })
    .eq('id', loserId);
  if (updLosErr) return json({ ok: false, error: updLosErr.message }, 500);

  // Record the result. Insert (not upsert) so a race between two clients
  // calling at once results in one INSERT succeeding and the other
  // failing — and the failing one will see `existing` on retry.
  const { error: insertErr } = await supabase
    .from('game_results')
    .insert({
      room_code,
      winner_user_id: winnerId,
      loser_user_id: loserId,
      is_draw: isDraw,
      winner_rating_before: winBefore,
      loser_rating_before: losBefore,
      winner_rating_after: winAfter,
      loser_rating_after: losAfter,
    });
  if (insertErr) return json({ ok: false, error: insertErr.message }, 500);

  // Tournament score updates: if both players are co-entered in any
  // currently-active tournament, bump both their entries. Wins are
  // worth 2 points, draws 1, losses 0. Multiple tournaments may apply
  // simultaneously. Best-effort — never block the rating update.
  try {
    const nowIso = new Date().toISOString();
    const { data: openTournaments } = await supabase
      .from('tournaments')
      .select('id')
      .lte('starts_at', nowIso)
      .gte('ends_at', nowIso);
    const tournamentIds = (openTournaments ?? []).map((t) => t.id as string);
    if (tournamentIds.length > 0) {
      const { data: entries } = await supabase
        .from('tournament_entries')
        .select('tournament_id, user_id, wins, losses, draws, score')
        .in('tournament_id', tournamentIds)
        .in('user_id', [winnerId, loserId]);
      if (entries) {
        // Group by tournament: only count if BOTH players are entered.
        const byTournament = new Map<string, typeof entries>();
        for (const e of entries) {
          const arr = byTournament.get(e.tournament_id) ?? [];
          arr.push(e);
          byTournament.set(e.tournament_id, arr);
        }
        for (const [tid, pair] of byTournament) {
          if (pair.length !== 2) continue;
          for (const e of pair) {
            const isWinnerSide = e.user_id === winnerId;
            const wins   = (e.wins   ?? 0) + (isDraw ? 0 : isWinnerSide ? 1 : 0);
            const losses = (e.losses ?? 0) + (isDraw ? 0 : isWinnerSide ? 0 : 1);
            const draws  = (e.draws  ?? 0) + (isDraw ? 1 : 0);
            const score  = (e.score  ?? 0) + (isDraw ? 1 : isWinnerSide ? 2 : 0);
            await supabase
              .from('tournament_entries')
              .update({ wins, losses, draws, score })
              .eq('tournament_id', tid)
              .eq('user_id', e.user_id);
          }
        }
      }
    }
  } catch (err) {
    console.error('[apply-rating] tournament update failed', err);
    // Continue — rating result still goes back as ok.
  }

  return json({
    ok: true,
    is_draw: isDraw,
    winner_id: winnerId,
    loser_id: loserId,
    winner_rating_before: winBefore,
    loser_rating_before: losBefore,
    winner_rating_after: winAfter,
    loser_rating_after: losAfter,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
