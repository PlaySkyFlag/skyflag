// Supabase Edge Function — revokes a single auth session (signs out
// that specific device). Two layers of safety:
//   1. We pull the caller's user_id from the JWT and only delete
//      sessions where user_id matches — users can't revoke each
//      other's devices.
//   2. We refuse to revoke the caller's CURRENT session via this
//      function — they should use plain `auth.signOut()` for that
//      so the local SDK clears its tokens cleanly.
//
// Deployment:
//   supabase functions deploy revoke-session --no-verify-jwt

// @ts-expect-error — Deno-only import.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-expect-error — Deno-only globals.
const env = (k: string): string | undefined => Deno.env.get(k);

const SUPABASE_URL = env('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') as string;
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY') as string;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'auth' as 'public' },
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

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ ok: false, error: 'unauthorized' }, 401);
  const callerSb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller } = await callerSb.auth.getUser();
  if (!caller?.user) return json({ ok: false, error: 'unauthorized' }, 401);

  let body: { session_id?: string; scope?: 'one' | 'others-only' };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'bad-json' }, 400);
  }

  // Pull current session from JWT so we can refuse to nuke it (or
  // exclude it for "others-only" mode).
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  let currentSessionId: string | null = null;
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    currentSessionId = (payload.session_id ?? payload.sid ?? null) as string | null;
  } catch {
    // No-op — older JWTs may not include the claim.
  }

  if (body.scope === 'others-only') {
    // Sign out every device EXCEPT the caller's current one. Useful as
    // a single-click "I think someone else has my password / token".
    let q = admin.from('sessions').delete().eq('user_id', caller.user.id);
    if (currentSessionId) q = q.neq('id', currentSessionId);
    const { error } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  const sessionId = body.session_id;
  if (!sessionId) return json({ ok: false, error: 'missing-session-id' }, 400);

  // Refuse to revoke the caller's current session — they'd be stuck
  // in a half-state (UI thinks they're signed in; refresh would fail).
  // The client should call plain `auth.signOut()` for the local
  // session so the SDK clears its own state too.
  if (currentSessionId && sessionId === currentSessionId) {
    return json({ ok: false, error: 'cant-revoke-current-session' }, 400);
  }

  const { error, count } = await admin
    .from('sessions')
    .delete({ count: 'exact' })
    .eq('id', sessionId)
    .eq('user_id', caller.user.id);
  if (error) return json({ ok: false, error: error.message }, 500);
  if ((count ?? 0) === 0) {
    return json({ ok: false, error: 'session-not-found' }, 404);
  }
  return json({ ok: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
