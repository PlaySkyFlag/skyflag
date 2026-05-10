// Supabase Edge Function — sends a turn notification to the player whose
// turn just started. Dispatches via Web Push (browser) and/or APNs (iOS),
// fan-out to every push_subscriptions row the recipient has.
//
// Trigger: the frontend POSTs { recipient_user_id, room_code, from_nickname }
// to this function after pushing a move that ends the turn.
//
// Deployment:
//   supabase functions deploy notify-turn --no-verify-jwt
//   supabase secrets set \
//     VAPID_PUBLIC_KEY=<public> \
//     VAPID_PRIVATE_KEY=<private> \
//     VAPID_SUBJECT=mailto:njatel@limnology.ca \
//     APNS_KEY_ID=<10-char Apple key id> \
//     APNS_TEAM_ID=<10-char Apple team id> \
//     APNS_BUNDLE_ID=com.limnology.skyflag \
//     APNS_KEY_P8="$(cat AuthKey_XXXX.p8)" \
//     APNS_HOST=api.sandbox.push.apple.com   # or api.push.apple.com for prod
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.

// @ts-expect-error — Deno-only import resolved at runtime, not by Vite.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
// @ts-expect-error — Deno-only.
import webpush from 'https://esm.sh/web-push@3.6.7';
// @ts-expect-error — Deno-only.
import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5.9.6';

// @ts-expect-error — Deno-only globals.
const env = (k: string): string | undefined => Deno.env.get(k);

const SUPABASE_URL = env('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') as string;
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY') as string;

const VAPID_PUBLIC_KEY = env('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = env('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = env('VAPID_SUBJECT') ?? 'mailto:njatel@limnology.ca';

const APNS_KEY_ID = env('APNS_KEY_ID') ?? '';
const APNS_TEAM_ID = env('APNS_TEAM_ID') ?? '';
const APNS_BUNDLE_ID = env('APNS_BUNDLE_ID') ?? 'com.limnology.skyflag';
const APNS_KEY_P8 = env('APNS_KEY_P8') ?? '';
const APNS_HOST = env('APNS_HOST') ?? 'api.push.apple.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache the APNs JWT for ~50 minutes — Apple requires re-signing every
// hour but rejects tokens older than that, so don't sign on every call.
let apnsJwt: { token: string; expires: number } | null = null;
async function getApnsJwt(): Promise<string | null> {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_KEY_P8) return null;
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt && apnsJwt.expires - 60 > now) return apnsJwt.token;
  const key = await importPKCS8(APNS_KEY_P8.replace(/\\n/g, '\n'), 'ES256');
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: APNS_KEY_ID })
    .setIssuer(APNS_TEAM_ID)
    .setIssuedAt(now)
    .sign(key);
  apnsJwt = { token, expires: now + 50 * 60 };
  return token;
}

async function sendApns(
  deviceToken: string,
  title: string,
  body: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const jwt = await getApnsJwt();
  if (!jwt) return { ok: false, error: 'apns-not-configured' };
  const url = `https://${APNS_HOST}/3/device/${deviceToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: 'default',
        badge: 1,
      },
    }),
  });
  if (res.ok) return { ok: true, status: res.status };
  const text = await res.text();
  return { ok: false, status: res.status, error: text };
}

// @ts-expect-error — Deno-only.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ ok: false, error: 'unauthorized' }, 401);
  const callerSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('platform, endpoint, p256dh, auth, apns_token')
    .eq('user_id', recipient_user_id);
  if (subErr) return json({ ok: false, error: subErr.message }, 500);
  if (!subs || subs.length === 0) return json({ ok: true, reason: 'no-subscriptions' });

  const title = from_nickname ? `${from_nickname} is waiting` : '3phor — your turn';
  const bodyText = `Tap to play. Room ${room_code}.`;

  const results: Array<{ platform: string; ok: boolean; error?: string }> = [];
  for (const sub of subs) {
    if (sub.platform === 'web' && sub.endpoint && sub.p256dh && sub.auth) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body: bodyText, url: '/' }),
        );
        results.push({ platform: 'web', ok: true });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        if (e.statusCode === 404 || e.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', recipient_user_id)
            .eq('platform', 'web');
        }
        results.push({ platform: 'web', ok: false, error: e.message ?? String(err) });
      }
    } else if (sub.platform === 'ios' && sub.apns_token) {
      const r = await sendApns(sub.apns_token, title, bodyText);
      // 410 from APNs = device unregistered, clean up.
      if (!r.ok && r.status === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', recipient_user_id)
          .eq('platform', 'ios');
      }
      results.push({ platform: 'ios', ok: r.ok, error: r.error });
    }
  }

  return json({ ok: true, results });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
