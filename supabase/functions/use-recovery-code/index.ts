// Supabase Edge Function — consumes a recovery code to regain access.
//
// Caller is UNAUTHENTICATED (they've lost access to email / OAuth).
// They submit {email, code}; we hash the code, look up an unused row
// for the user with that email, mark it used, and issue a one-time
// sign-in link using auth.admin.generateLink. The link is returned in
// the response and the client redirects to it — putting the user back
// into a real authenticated session without needing email access.
//
// Why this is safe: the recovery codes were shown to the user once at
// generation time. Possessing one (with the matching email) is the
// proof of identity. After consumption the code is invalidated.

// @ts-expect-error — Deno-only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-expect-error — Deno-only globals.
const env = (k: string): string | undefined => Deno.env.get(k);
const SUPABASE_URL = env('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY') as string;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  // @ts-expect-error — Deno crypto.subtle.
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Normalize a user-typed code — strip whitespace, uppercase, ensure the
// dashes are in canonical positions. Lets the user type with or without
// dashes and any case.
function normalizeCode(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length !== 16) return raw;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}`;
}

// Rate-limit windows. Generous enough that a legitimate user fumbling
// the code a few times isn't locked out, strict enough that a script
// can't grind millions of attempts. Backed by public.recovery_code_attempts
// (see migration 023). Per-email limit is the primary defense (an attacker
// usually knows or guesses the target email); per-IP secondary, in case a
// single attacker tries many emails from one source.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_EMAIL_PER_WINDOW = 5;
const MAX_PER_IP_PER_WINDOW = 20;

function clientIp(req: Request): string | null {
  // Supabase routes through Cloudflare; cf-connecting-ip is the most
  // reliable header. Fall back to x-forwarded-for first hop.
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return null;
}

// @ts-expect-error — Deno-only.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  let body: { email?: string; code?: string; redirect_to?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'bad-json' }, 400);
  }
  const email = body.email?.trim().toLowerCase();
  const code = body.code ? normalizeCode(body.code) : null;
  if (!email || !code) {
    return json({ ok: false, error: 'missing-params' }, 400);
  }

  const ip = clientIp(req);
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

  // Per-email throttle. Recent attempts are counted regardless of success
  // so a successful retry doesn't reset the counter — keeps the per-window
  // ceiling honest. The successful attempt itself still gets through; only
  // subsequent attempts within the window are blocked.
  const { count: emailCount, error: emailCountErr } = await admin
    .from('recovery_code_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('attempted_at', windowStart);
  if (emailCountErr) {
    console.error('[use-recovery-code] rate-check email failed', emailCountErr);
    // Fail-closed: if the rate-limit table is unreachable, reject rather
    // than allowing unlimited attempts.
    return json({ ok: false, error: 'temporarily-unavailable' }, 503);
  }
  if ((emailCount ?? 0) >= MAX_PER_EMAIL_PER_WINDOW) {
    return json({ ok: false, error: 'too-many-attempts' }, 429);
  }

  // Per-IP throttle (only when we have an IP; if absent, skip rather than
  // hard-fail — Supabase's edge runtime should always provide one).
  if (ip) {
    const { count: ipCount, error: ipCountErr } = await admin
      .from('recovery_code_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('attempted_at', windowStart);
    if (ipCountErr) {
      console.error('[use-recovery-code] rate-check ip failed', ipCountErr);
      return json({ ok: false, error: 'temporarily-unavailable' }, 503);
    }
    if ((ipCount ?? 0) >= MAX_PER_IP_PER_WINDOW) {
      return json({ ok: false, error: 'too-many-attempts' }, 429);
    }
  }

  // Helper to log this attempt. Fire-and-forget so a logging hiccup
  // doesn't block the user's response — the worst case is a missed
  // rate-limit window, which we'd rather have than a false 5xx.
  const logAttempt = (success: boolean) => {
    admin
      .from('recovery_code_attempts')
      .insert({ email, ip, success })
      .then((r: { error: { message: string } | null }) => {
        if (r.error) console.error('[use-recovery-code] log failed', r.error);
      });
  };

  // Find the user by email. admin.listUsers is paginated, so use the
  // direct query instead.
  const { data: users, error: lookupErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    // @ts-expect-error — filter param is supported by Supabase Auth Admin.
    filter: `email = "${email}"`,
  });
  if (lookupErr) {
    console.error('[use-recovery-code] listUsers failed', lookupErr);
    return json({ ok: false, error: 'lookup-failed' }, 500);
  }
  const user = (users?.users ?? []).find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    // Generic error so attackers can't enumerate registered emails.
    logAttempt(false);
    return json({ ok: false, error: 'invalid-code' }, 401);
  }

  // Look up an unused matching code.
  const codeHash = await sha256(code);
  const { data: row, error: findErr } = await admin
    .from('recovery_codes')
    .select('id, used_at')
    .eq('user_id', user.id)
    .eq('code_hash', codeHash)
    .is('used_at', null)
    .maybeSingle();
  if (findErr) {
    console.error('[use-recovery-code] find failed', findErr);
    return json({ ok: false, error: 'lookup-failed' }, 500);
  }
  if (!row) {
    logAttempt(false);
    return json({ ok: false, error: 'invalid-code' }, 401);
  }

  // Mark consumed BEFORE issuing the link — fail-closed on a race.
  const { error: markErr } = await admin
    .from('recovery_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id);
  if (markErr) {
    console.error('[use-recovery-code] mark-used failed', markErr);
    return json({ ok: false, error: 'mark-failed' }, 500);
  }

  // Issue a one-time sign-in link. The client navigates to action_link
  // and Supabase Auth handles the rest — issuing a session, firing
  // onAuthStateChange, etc.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: body.redirect_to ?? undefined,
    },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[use-recovery-code] generateLink failed', linkErr);
    return json({ ok: false, error: 'link-failed' }, 500);
  }

  logAttempt(true);
  return json({
    ok: true,
    action_link: linkData.properties.action_link,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
