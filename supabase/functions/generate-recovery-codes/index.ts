// Supabase Edge Function — generates 8 fresh recovery codes for the
// signed-in caller. Returns the plaintext codes ONCE; only their
// SHA-256 hashes are stored. The user is responsible for saving them.
//
// Idempotent overwrite: any existing codes for this user (used or
// unused) are deleted before the new 8 are inserted, so the user has
// exactly 8 valid codes after each generation.

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

// Crockford-ish alphabet — 32 chars, no ambiguous 0/O/I/L/1. Each code
// is 16 chars (4 groups of 4 separated by dashes) = 80 bits of entropy.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LEN = 16; // 4 groups of 4

function genCode(): string {
  // @ts-expect-error — Deno globals.
  const bytes = new Uint8Array(CODE_LEN);
  // @ts-expect-error — Deno globals.
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    s += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3 || i === 7 || i === 11) s += '-';
  }
  return s;
}

async function sha256(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  // @ts-expect-error — Deno crypto.subtle.
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

  // Require a verified email — recovery codes are useless for guests
  // because we'd have no way to identify the account on recovery.
  if (!caller.user.email_confirmed_at) {
    return json(
      {
        ok: false,
        error: 'verify-email-first',
        detail: 'Recovery codes need a verified email — link one first, then come back.',
      },
      400,
    );
  }

  // Generate 8 fresh codes and their hashes.
  const codes: string[] = [];
  const rows: Array<{ user_id: string; code_hash: string }> = [];
  for (let i = 0; i < 8; i++) {
    const code = genCode();
    codes.push(code);
    rows.push({ user_id: caller.user.id, code_hash: await sha256(code) });
  }

  // Replace existing codes atomically. Two writes, not transactional,
  // but the delete + insert order means a partial failure leaves the
  // user with zero codes (re-generatable) rather than mixed old + new.
  const { error: delErr } = await admin
    .from('recovery_codes')
    .delete()
    .eq('user_id', caller.user.id);
  if (delErr) return json({ ok: false, error: delErr.message }, 500);

  const { error: insErr } = await admin.from('recovery_codes').insert(rows);
  if (insErr) return json({ ok: false, error: insErr.message }, 500);

  return json({ ok: true, codes });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
