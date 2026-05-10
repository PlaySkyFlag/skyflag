// User data export — bundles everything tied to the signed-in user
// into a single JSON blob and triggers a browser download.
//
// Why client-side: every table the user owns is already readable by
// RLS to its own user, so no Edge Function or service-role is needed.
// The user's auth JWT scopes every query to their own data only.
//
// PIPEDA + App Store policy both require a user-portable data export.

import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

type ExportBundle = {
  // Top-level metadata — when this export was produced + what it covers.
  exported_at: string;
  user: {
    id: string;
    email: string | null;
    email_confirmed_at: string | null;
    created_at: string | null;
  };
  // Authoritative server-side data. Per-table arrays — empty if the
  // user has no rows of that kind.
  profile: unknown;
  game_results: unknown[];
  tournament_entries: unknown[];
  friendships: unknown[];
  push_subscriptions: unknown[];
  subscriptions: unknown[];
  entitlements: unknown[];
  purchases: unknown[];
  tournaments_created: unknown[];
  // Local-only data — what's in localStorage for this device. Useful
  // for portability + transparency about what we stash on-device.
  local_stats: unknown;
  local_session_present: boolean;
};

export async function exportUserData(user: User): Promise<ExportBundle> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const sb = supabase;

  // Run all reads in parallel — RLS limits each to the caller's rows.
  const [
    profile,
    gameResults,
    tournamentEntries,
    friendships,
    pushSubs,
    subs,
    ents,
    purchases,
    tournamentsCreated,
  ] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    sb
      .from('game_results')
      .select('*')
      .or(`winner_user_id.eq.${user.id},loser_user_id.eq.${user.id}`),
    sb.from('tournament_entries').select('*').eq('user_id', user.id),
    sb
      .from('friendships')
      .select('*')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
    sb.from('push_subscriptions').select('*').eq('user_id', user.id),
    sb.from('subscriptions').select('*').eq('user_id', user.id),
    sb.from('entitlements').select('*').eq('user_id', user.id),
    sb.from('purchases').select('*').eq('user_id', user.id),
    sb.from('tournaments').select('*').eq('created_by', user.id),
  ]);

  // localStorage stats — the per-device W/L log. Read defensively in
  // case private-browsing mode disables localStorage.
  let localStats: unknown = null;
  let sessionPresent = false;
  try {
    const statsRaw = localStorage.getItem('3phor.stats.v1');
    if (statsRaw) localStats = JSON.parse(statsRaw);
    sessionPresent = localStorage.getItem('3phor.session.v1') !== null;
  } catch {
    /* private mode */
  }

  return {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
      created_at: user.created_at ?? null,
    },
    profile: profile.data ?? null,
    game_results: gameResults.data ?? [],
    tournament_entries: tournamentEntries.data ?? [],
    friendships: friendships.data ?? [],
    push_subscriptions: pushSubs.data ?? [],
    subscriptions: subs.data ?? [],
    entitlements: ents.data ?? [],
    purchases: purchases.data ?? [],
    tournaments_created: tournamentsCreated.data ?? [],
    local_stats: localStats,
    local_session_present: sessionPresent,
  };
}

// Triggers a browser download for the bundled JSON. Filename includes
// today's date so multiple exports don't overwrite each other in the
// downloads folder.
export function downloadExportFile(bundle: ExportBundle): void {
  const filename = `3phor-data-export-${bundle.exported_at.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
