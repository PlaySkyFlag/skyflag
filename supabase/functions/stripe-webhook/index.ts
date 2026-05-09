// Supabase Edge Function — receives Stripe webhook events and writes
// subscription / entitlement state to our DB. This is the ONLY way
// entitlements get granted in the system; the client never writes them.
//
// Configure in the Stripe Dashboard:
//   Developers → Webhooks → Add endpoint
//   URL: https://<project>.supabase.co/functions/v1/stripe-webhook
//   Events to send:
//     - customer.subscription.created
//     - customer.subscription.updated
//     - customer.subscription.deleted
//     - invoice.payment_succeeded
//
// The webhook signing secret (whsec_...) goes in:
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// Idempotency: Stripe may deliver the same event multiple times.
// upsert on (source, source_subscription_id) makes the
// subscriptions table updates idempotent. entitlements use upsert
// on (user_id, entitlement_id) for the same reason.
//
// Note: this function should be deployed with --no-verify-jwt because
// Stripe doesn't send a Supabase JWT — we verify the request via the
// Stripe-Signature header instead.

// @ts-expect-error — Deno-only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
// @ts-expect-error — Deno-only.
import Stripe from 'https://esm.sh/stripe@17.5.0?target=denonext';

// @ts-expect-error — Deno-only globals.
const env = (k: string): string | undefined => Deno.env.get(k);
const SUPABASE_URL = env('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') as string;
const STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY') as string;
const STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET') as string;
// Map Stripe price IDs → tiers we use internally. Set via env so launching
// a new tier doesn't require a function redeploy. Format: price_..|plus.
// Multiple mappings comma-separated:
//   STRIPE_PRICES=price_abc|plus,price_xyz|premium
const STRIPE_PRICES = env('STRIPE_PRICES') ?? '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Parse STRIPE_PRICES env into a lookup table.
const PRICE_TO_TIER: Record<string, string> = {};
for (const pair of STRIPE_PRICES.split(',')) {
  const [priceId, tier] = pair.split('|').map((s) => s.trim());
  if (priceId && tier) PRICE_TO_TIER[priceId] = tier;
}

// Map our internal tiers → entitlement IDs the client checks for. Adding
// a new entitlement to a tier means adding a row here AND seeding the
// frontend gating logic to look for it.
const TIER_TO_ENTITLEMENT: Record<string, string> = {
  plus: 'feature.plus',
  premium: 'feature.premium',
};

// @ts-expect-error — Deno-only.
Deno.serve(async (req: Request) => {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('no signature', { status: 400 });

  // Stripe requires the RAW body bytes for signature verification —
  // any JSON parse / re-stringify would change the bytes and fail.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'verification failed';
    return new Response(`signature verification failed: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        await markSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.payment_succeeded': {
        // Renewal — re-fetch the subscription so we get the new
        // current_period_end and refresh the entitlement expiry.
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(sub);
        }
        break;
      }
      default:
        // Ignore other events — Stripe sends a lot of noise we don't
        // need (charges, refunds at the invoice level, etc.). Adding
        // a case is the only way to act on them later.
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error', err);
    // Return 500 so Stripe retries. The DB writes are idempotent so
    // a retry won't double-grant.
    return new Response('handler error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});

// Upsert the subscription record AND the matching entitlement.
async function upsertSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.user_id;
  if (!userId) {
    console.error('[stripe-webhook] subscription has no user_id metadata', sub.id);
    return;
  }

  const priceId = sub.items.data[0]?.price.id;
  const tier = priceId ? PRICE_TO_TIER[priceId] : undefined;
  if (!tier) {
    console.error('[stripe-webhook] unknown price id', priceId);
    return;
  }

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  const startedAt = sub.start_date
    ? new Date(sub.start_date * 1000).toISOString()
    : new Date().toISOString();
  const cancelledAt = sub.canceled_at
    ? new Date(sub.canceled_at * 1000).toISOString()
    : null;

  const status = mapStripeStatus(sub.status);

  const { error: subErr } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        tier,
        status,
        source: 'stripe',
        source_subscription_id: sub.id,
        started_at: startedAt,
        current_period_end: periodEnd,
        cancelled_at: cancelledAt,
      },
      { onConflict: 'source,source_subscription_id' },
    );
  if (subErr) {
    console.error('[stripe-webhook] subscription upsert failed', subErr);
    throw subErr;
  }

  // Grant or revoke the entitlement based on subscription status.
  const entitlementId = TIER_TO_ENTITLEMENT[tier];
  if (!entitlementId) return;

  const isActive = status === 'active';
  if (isActive && periodEnd) {
    const { error } = await supabase.from('entitlements').upsert(
      {
        user_id: userId,
        entitlement_id: entitlementId,
        granted_at: startedAt,
        expires_at: periodEnd,
        source: `subscription:${sub.id}`,
      },
      { onConflict: 'user_id,entitlement_id' },
    );
    if (error) console.error('[stripe-webhook] entitlement upsert failed', error);
  } else {
    // Subscription is past_due / cancelled / unpaid — revoke entitlement.
    // Don't revoke for 'pending' so checkout-in-progress doesn't yank
    // access mid-flow.
    if (status !== 'pending') {
      const { error } = await supabase
        .from('entitlements')
        .delete()
        .eq('user_id', userId)
        .eq('entitlement_id', entitlementId);
      if (error) console.error('[stripe-webhook] entitlement delete failed', error);
    }
  }
}

async function markSubscriptionCancelled(sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.user_id;
  if (!userId) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('source', 'stripe')
    .eq('source_subscription_id', sub.id);

  // Remove the entitlement so the user immediately loses access. If
  // we wanted "access until end of billing period", we'd skip this
  // and let expires_at do its job — depends on product policy.
  const priceId = sub.items.data[0]?.price.id;
  const tier = priceId ? PRICE_TO_TIER[priceId] : undefined;
  if (!tier) return;
  const entitlementId = TIER_TO_ENTITLEMENT[tier];
  if (!entitlementId) return;
  await supabase
    .from('entitlements')
    .delete()
    .eq('user_id', userId)
    .eq('entitlement_id', entitlementId);
}

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'canceled':
      return 'cancelled';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
    case 'incomplete_expired':
      return 'expired';
    case 'incomplete':
    case 'paused':
    default:
      return 'pending';
  }
}
