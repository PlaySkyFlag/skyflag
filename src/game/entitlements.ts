// Entitlements hooks — read-side wrapper for the entitlements table
// added in migration 010. Components use these to gate paid features
// without knowing how entitlements got granted (Stripe webhook, Apple
// receipt verification, promotion code, gift, etc.).
//
// Pattern:
//   const { hasIt } = useEntitlement('feature.advanced_ai');
//   return hasIt ? <DeepDifficultyPicker /> : <UpgradePrompt />;
//
// Subscriptions: realtime listens to the entitlements table filtered
// to the current user, so a freshly-granted entitlement (e.g. from a
// Stripe webhook firing seconds after checkout) shows up live without
// needing a page refresh.
//
// Loading state: 'loading' is true on initial fetch ONLY. After the
// first fetch completes, subsequent realtime updates re-fetch silently
// without flipping `loading` on, so UI doesn't flicker when a webhook
// modifies an unrelated entitlement.

import { useEffect, useState } from 'react';
import { useAuthUser } from './auth';
import { supabase } from './supabase';

type EntitlementRow = {
  entitlement_id: string;
  expires_at: string | null;
};

// Returns the set of all active entitlement IDs for the signed-in user.
// Active = not expired (or permanent — null expires_at). Empty set
// while signed out or while loading.
export function useEntitlements(): { entitlements: Set<string>; loading: boolean } {
  const { user } = useAuthUser();
  const [entitlements, setEntitlements] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) {
      setEntitlements(new Set());
      setLoading(false);
      return;
    }

    let mounted = true;
    const sb = supabase;
    const userId = user.id;

    const refetch = async () => {
      const { data } = await sb
        .from('entitlements')
        .select('entitlement_id, expires_at')
        .eq('user_id', userId);
      if (!mounted) return;
      const now = Date.now();
      const active = new Set<string>();
      for (const row of (data ?? []) as EntitlementRow[]) {
        if (!row.expires_at || new Date(row.expires_at).getTime() > now) {
          active.add(row.entitlement_id);
        }
      }
      setEntitlements(active);
      setLoading(false);
    };

    refetch();

    // Realtime — pick up grants/revokes from server-side processes
    // (Stripe webhook, Apple receipt verification, etc.) without a
    // page refresh.
    const channel = sb
      .channel(`entitlements:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entitlements',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Don't toggle loading=true on subsequent refetches; UI
          // shouldn't flicker while we re-read.
          refetch();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      sb.removeChannel(channel);
    };
  }, [user]);

  return { entitlements, loading };
}

// Convenience for checking a single entitlement. Stable across renders
// — the wrapping component re-renders when `hasIt` changes from
// false → true (i.e. webhook grants the entitlement).
export function useEntitlement(id: string): { hasIt: boolean; loading: boolean } {
  const { entitlements, loading } = useEntitlements();
  return { hasIt: entitlements.has(id), loading };
}
