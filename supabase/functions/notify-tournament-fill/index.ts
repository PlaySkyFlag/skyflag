// Supabase Edge Function — fans out a "new tournament needs players"
// push notification to every user who has notify_tournament_fill=true,
// excluding the creator. De-duped via tournament_fill_notifications so
// repeated calls don't double-notify (idempotent).
//
// Trigger: the frontend POSTs { tournament_id } from Tournaments.tsx
// immediately after a user-created INSERT succeeds.
//
// Deployment:
//   supabase functions deploy notify-tournament-fill --no-verify-jwt
// Secrets reused from notify-turn (VAPID_*, APNS_*).

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
  url: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const jwt = await getApnsJwt();
  if (!jwt) return { ok: false, error: 'apns-not-configured' };
  const apnsUrl = `https://${APNS_HOST}/3/device/${deviceToken}`;
  const res = await fetch(apnsUrl, {
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
      url,
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

  // Auth check — must be a real signed-in user. We don't require the
  // caller to be the tournament's creator (frontend already gates this);
  // the only thing this guards against is anonymous spam of the function.
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ ok: false, error: 'unauthorized' }, 401);
  const callerSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller } = await callerSb.auth.getUser();
  if (!caller?.user) return json({ ok: false, error: 'unauthorized' }, 401);

  let body: { tournament_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'bad-json' }, 400);
  }
  const tournamentId = body.tournament_id;
  if (!tournamentId) return json({ ok: false, error: 'missing-tournament-id' }, 400);

  // Load the tournament so we can include the name in the notification
  // and verify it actually exists / hasn't ended.
  const { data: t, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name, ends_at, created_by')
    .eq('id', tournamentId)
    .maybeSingle();
  if (tErr || !t) return json({ ok: false, error: 'tournament-not-found' }, 404);
  if (new Date(t.ends_at as string).getTime() < Date.now()) {
    return json({ ok: false, error: 'tournament-already-ended' }, 410);
  }

  // Find opted-in users (excluding the creator — they don't need to be
  // notified about their own tournament).
  const { data: profs, error: pErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('notify_tournament_fill', true);
  if (pErr) return json({ ok: false, error: pErr.message }, 500);
  const creatorId = (t.created_by as string | null) ?? caller.user.id;
  const candidates = (profs ?? [])
    .map((p) => p.id as string)
    .filter((id) => id !== creatorId);

  if (candidates.length === 0) {
    return json({ ok: true, sent: 0, reason: 'no-opted-in-users' });
  }

  // De-dup: skip users we've already notified for this tournament.
  // Read the sent-log, then filter.
  const { data: alreadySent } = await supabase
    .from('tournament_fill_notifications')
    .select('user_id')
    .eq('tournament_id', tournamentId)
    .in('user_id', candidates);
  const sentSet = new Set((alreadySent ?? []).map((r) => r.user_id as string));
  const recipients = candidates.filter((id) => !sentSet.has(id));

  if (recipients.length === 0) {
    return json({ ok: true, sent: 0, reason: 'all-already-notified' });
  }

  // Pull all push subscriptions for the recipient set in one query, so
  // we don't issue N round-trips for N recipients.
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, platform, endpoint, p256dh, auth, apns_token')
    .in('user_id', recipients);
  if (subErr) return json({ ok: false, error: subErr.message }, 500);

  const title = '3phor — new tournament';
  const bodyText = `"${(t.name as string).slice(0, 60)}" just opened. Tap to join.`;
  const targetUrl = '/play';

  let attempted = 0;
  let succeeded = 0;
  const notifiedUsers = new Set<string>();

  for (const sub of subs ?? []) {
    attempted += 1;
    if (sub.platform === 'web' && sub.endpoint && sub.p256dh && sub.auth) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body: bodyText, url: targetUrl }),
        );
        succeeded += 1;
        notifiedUsers.add(sub.user_id as string);
      } catch (err: unknown) {
        const e = err as { statusCode?: number };
        if (e.statusCode === 404 || e.statusCode === 410) {
          // Endpoint expired — clean up the dead row so future fan-outs
          // don't keep retrying it.
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', sub.user_id)
            .eq('platform', 'web');
        }
      }
    } else if (sub.platform === 'ios' && sub.apns_token) {
      const r = await sendApns(sub.apns_token as string, title, bodyText, targetUrl);
      if (r.ok) {
        succeeded += 1;
        notifiedUsers.add(sub.user_id as string);
      } else if (r.status === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', sub.user_id)
          .eq('platform', 'ios');
      }
    }
  }

  // Record everyone we successfully delivered to. If a user has both web
  // and ios subs, the upsert keeps a single row (composite PK).
  if (notifiedUsers.size > 0) {
    const rows = Array.from(notifiedUsers).map((user_id) => ({
      user_id,
      tournament_id: tournamentId,
    }));
    await supabase
      .from('tournament_fill_notifications')
      .upsert(rows, { onConflict: 'user_id,tournament_id', ignoreDuplicates: true });
  }

  return json({
    ok: true,
    candidates: candidates.length,
    recipients: recipients.length,
    attempted,
    sent: succeeded,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
