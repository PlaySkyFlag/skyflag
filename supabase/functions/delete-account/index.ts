// Supabase Edge Function — permanently deletes the caller's account.
//
// PIPEDA + App Store policy both require a user-initiated delete path.
// Users invoke this from AccountModal → Delete my account. The function
// verifies the caller is signed in, then calls auth.admin.deleteUser()
// using the service role — which cascades through every FK that
// references auth.users(id) ON DELETE CASCADE:
//
//   - profiles
//   - push_subscriptions
//   - subscriptions / entitlements / purchases
//   - tournament_entries
//   - friendships
//
// Game records (game_results.winner_user_id / loser_user_id) use
// ON DELETE SET NULL so the historical game survives but with an
// anonymous "[deleted user]" reference — preserves opponents' records.
// Tournaments the user created (created_by) use ON DELETE SET NULL
// too; their tournaments live on but are unowned.
//
// Deployment:
//   supabase functions deploy delete-account
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected.

// @ts-expect-error — Deno-only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-expect-error — Deno-only globals.
const env = (k: string): string | undefined => Deno.env.get(k);
const SUPABASE_URL = env('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') as string;
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY') as string;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-expect-error — Deno-only.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  // Auth check — caller must be signed in. We verify their JWT via the
  // anon-key client so an attacker can't pass a forged auth.uid().
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ ok: false, error: 'unauthorized' }, 401);
  const callerSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller } = await callerSb.auth.getUser();
  if (!caller?.user) return json({ ok: false, error: 'unauthorized' }, 401);

  const userId = caller.user.id;

  // Cancel any active Stripe subscriptions before deleting — the
  // subscription record will cascade-delete with auth.users, but the
  // upstream Stripe record won't, so the user would keep getting
  // charged. Best-effort; we still proceed with the delete on failure.
  try {
    const STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY');
    if (STRIPE_SECRET_KEY) {
      const { data: subs } = await admin
        .from('subscriptions')
        .select('source_subscription_id, status')
        .eq('user_id', userId)
        .eq('source', 'stripe')
        .eq('status', 'active');
      if (subs && subs.length > 0) {
        for (const s of subs) {
          if (!s.source_subscription_id) continue;
          // Cancel immediately — no proration. Compliance > convenience.
          await fetch(
            `https://api.stripe.com/v1/subscriptions/${s.source_subscription_id}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
              },
            },
          ).catch((err) => {
            console.error('[delete-account] stripe cancel failed', err);
          });
        }
      }
    }
  } catch (err) {
    console.error('[delete-account] stripe cleanup error', err);
    // Continue — don't block deletion on Stripe hiccup.
  }

  // Delete the auth.users row. All FK-cascades fire here.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error('[delete-account] auth.admin.deleteUser failed', delErr);
    return json({ ok: false, error: delErr.message }, 500);
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
