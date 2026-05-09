// Supabase Edge Function — creates a Stripe Checkout Session for the
// signed-in user and returns the redirect URL. The client redirects
// the browser to that URL; Stripe hosts the actual checkout form.
//
// Why server-side: the Stripe SECRET key never leaves Supabase. Clients
// only get the redirect URL, which is single-use and tied to the
// authenticated user via session metadata.
//
// Request body:
//   { price_id: string, success_url: string, cancel_url: string }
//
// Response:
//   { url: string }   on success
//   { error: string } on failure
//
// Deployment:
//   supabase functions deploy create-checkout-session
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...   (or sk_test_...)
//
// SUPABASE_URL and SUPABASE_ANON_KEY are auto-injected by Supabase.

// @ts-expect-error — Deno-only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
// @ts-expect-error — Deno-only.
import Stripe from 'https://esm.sh/stripe@17.5.0?target=denonext';

// @ts-expect-error — Deno-only globals.
const env = (k: string): string | undefined => Deno.env.get(k);
const SUPABASE_URL = env('SUPABASE_URL') as string;
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY') as string;
const STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY') as string;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-expect-error — Deno-only.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  // Auth check — caller must be signed in.
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const callerSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller } = await callerSb.auth.getUser();
  if (!caller?.user) return json({ error: 'unauthorized' }, 401);

  let body: { price_id?: string; success_url?: string; cancel_url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad-json' }, 400);
  }

  const { price_id, success_url, cancel_url } = body;
  if (!price_id || !success_url || !cancel_url) {
    return json({ error: 'missing-params' }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      // Pre-fill the email field on the Stripe checkout for a smoother
      // signed-in experience. Anonymous users (no email) get an empty
      // field and Stripe asks them to enter one.
      customer_email: caller.user.email ?? undefined,
      // Metadata threads the Supabase user id through Stripe's records
      // so the webhook can map the resulting subscription back to the
      // right user. Set on BOTH the session and the subscription_data
      // so it propagates to the subscription that gets created.
      metadata: { user_id: caller.user.id },
      subscription_data: {
        metadata: { user_id: caller.user.id },
      },
      // Allow promo codes to be entered on the checkout page —
      // critical for influencer / launch promotions later.
      allow_promotion_codes: true,
    });

    return json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
