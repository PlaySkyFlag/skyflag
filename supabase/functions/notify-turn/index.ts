// Supabase Edge Function — sends a Web Push notification to the player
// whose turn just started.
//
// Trigger: the frontend POSTs { recipient_user_id, room_code } to this
// function after pushing a move to the room. The function looks up the
// recipient's saved push subscription and dispatches a Web Push using the
// project's VAPID keys.
//
// Deployment:
//   supabase functions deploy notify-turn
//   supabase secrets set VAPID_PUBLIC_KEY=<from .env.production>
//   supabase secrets set VAPID_PRIVATE_KEY=<the matching private key>
//   supabase secrets set VAPID_SUBJECT=mailto:njatel@limnology.ca
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.

// @ts-expect-error — Deno-only import resolved at runtime, not by Vite.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
// @ts-expect-error — Deno-only.
import webpush from 'https://esm.sh/web-push@3.6.7';

// @ts-expect-error — Deno-only globals.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
// @ts-expect-error — Deno-only globals.
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
// @ts-expect-error — Deno-only globals.
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') as string;
// @ts-expect-error — Deno-only globals.
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') as string;
// @ts-expect-error — Deno-only globals.
const VAPID_SUBJECT = (Deno.env.get('VAPID_SUBJECT') as string) || 'mailto:njatel@limnology.ca';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// CORS headers for the browser-initiated POST.
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

  // Verify caller is signed in. We pass the caller's JWT via Authorization
  // and let supabase.auth verify it. The actual recipient lookup uses the
  // service-role key (bypassing RLS).
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ ok: false, error: 'unauthorized' }, 401);
  const callerSb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') as string, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller } = await callerSb.auth.getUser();
  if (!caller?.user) return json({ ok: false, error: 'unauthorized' }, 401);

  let body: { recipient_user_id?: string; room_code?: string; from_nickname?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'bad-json' }, 400);
  }
  const { recipient_user_id, room_code, from_nickname } = body;
  if (!recipient_user_id || !room_code) return json({ ok: false, error: 'missing-fields' }, 400);

  const { data: sub, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', recipient_user_id)
    .maybeSingle();
  if (subErr) return json({ ok: false, error: subErr.message }, 500);
  if (!sub) return json({ ok: true, reason: 'no-subscription' });

  const payload = JSON.stringify({
    title: from_nickname ? `${from_nickname} is waiting` : 'SkyFlag — your turn',
    body: `Tap to play. Room ${room_code}.`,
    url: '/',
  });

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    );
    return json({ ok: true });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    // 410 Gone / 404 = subscription expired; clean it up so we don't keep
    // hammering a dead endpoint on every move.
    if (e.statusCode === 404 || e.statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('user_id', recipient_user_id);
      return json({ ok: true, reason: 'subscription-expired-cleaned' });
    }
    return json({ ok: false, error: e.message ?? String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
