// Supabase Edge Function — returns the list of active auth sessions
// for the currently signed-in user, plus a flag identifying which one
// is the caller's current session (so the UI can disable "Revoke" on
// it and offer it via plain `auth.signOut()` instead).
//
// auth.sessions lives in the protected `auth` schema and is service-
// role only; we read it via the service-role client and filter to the
// caller's user_id so users can never see anyone else's sessions.
//
// Deployment:
//   supabase functions deploy list-sessions --no-verify-jwt
// (No new secrets needed — uses the auto-injected SUPABASE_URL and
//  SUPABASE_SERVICE_ROLE_KEY.)

// @ts-expect-error — Deno-only import.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-expect-error — Deno-only globals.
const env = (k: string): string | undefined => Deno.env.get(k);

const SUPABASE_URL = env('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') as string;
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY') as string;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  // The auth schema isn't exposed via PostgREST by default; we hit it
  // directly with the service-role client which bypasses that layer.
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

  // Pull the session id from the JWT payload so we can mark which row
  // in the list is the caller's current session. The session_id claim
  // is `session_id` in newer Supabase JWTs; older tokens use `sid`.
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  let currentSessionId: string | null = null;
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    currentSessionId = (payload.session_id ?? payload.sid ?? null) as string | null;
  } catch {
    // Best-effort — older tokens may not include the claim. The UI
    // will fall back to "no current session marked" which is fine.
  }

  const { data, error } = await admin
    .from('sessions')
    .select('id, user_agent, ip, created_at, updated_at')
    .eq('user_id', caller.user.id)
    .order('updated_at', { ascending: false });
  if (error) return json({ ok: false, error: error.message }, 500);

  const rows = (data ?? []).map((s) => ({
    id: s.id as string,
    user_agent: (s.user_agent as string | null) ?? null,
    ip: (s.ip as string | null) ?? null,
    created_at: s.created_at as string,
    updated_at: s.updated_at as string,
    current: s.id === currentSessionId,
  }));

  return json({ ok: true, sessions: rows });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
