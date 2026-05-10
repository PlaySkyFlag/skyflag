// Active-sessions client wrapper. Thin layer over the list-sessions
// and revoke-session edge functions; UI components read sessions and
// fire revokes through here so they don't need to know about the
// edge functions or JWT plumbing.
//
// Sign-out-everywhere is a separate path: it uses Supabase's native
// `auth.signOut({ scope: 'global' })` which revokes every refresh
// token for the user, including the local one. Don't combine with
// these per-session calls.

import { supabase } from './supabase';

export type SessionRow = {
  id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  updated_at: string;
  // True if this row corresponds to the caller's current sign-in. The
  // UI uses this to disable per-session revoke (the caller should use
  // plain auth.signOut() for their own session) and to show a "this
  // device" label.
  current: boolean;
};

export async function listSessions(): Promise<SessionRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    sessions?: SessionRow[];
    error?: string;
  }>('list-sessions');
  if (error || !data?.ok) {
    console.error('[sessions] list failed', error ?? data?.error);
    return [];
  }
  return data.sessions ?? [];
}

export async function revokeSession(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    error?: string;
  }>('revoke-session', {
    body: { session_id: sessionId },
  });
  if (error) return { ok: false, message: error.message };
  if (!data?.ok) return { ok: false, message: data?.error ?? 'unknown' };
  return { ok: true };
}

// Revoke every session EXCEPT the caller's current one. Useful for
// "someone else has my account" panic — kick all other devices in one
// click without losing the current tab.
export async function revokeAllOtherSessions(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    error?: string;
  }>('revoke-session', {
    body: { scope: 'others-only' },
  });
  if (error) return { ok: false, message: error.message };
  if (!data?.ok) return { ok: false, message: data?.error ?? 'unknown' };
  return { ok: true };
}

// Pretty-print a User-Agent string for the sessions list. Picks out the
// browser + OS so the row is scannable; unknown UAs fall through to
// the raw string. Not exhaustive — just covers common combos.
export function summarizeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua) && !/Chromium\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua) && !/Chrome\//.test(ua)
          ? 'Safari'
          : null;
  const os = /Windows NT/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return ua.slice(0, 60);
}
