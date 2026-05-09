// Supabase Auth wrapper. Three sign-in methods supported:
//   - Email magic link (works everywhere, no extra config)
//   - Anonymous (instant guest, requires the Supabase anon-sign-in toggle)
//   - OAuth (Apple/Google) via Supabase's web OAuth flow. On iOS this
//     opens in Safari View Controller and returns to the app via the
//     redirect URL. Native iOS Apple sign-in (Capacitor plugin) is
//     deferred — the @capacitor-community/apple-sign-in plugin's
//     latest release pins to Capacitor 7, conflicting with Capacitor 8
//     push-notifications. Will revisit when the plugin updates.

import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Reactive hook: returns the current Supabase user (or null while loading
// or signed-out). Subscribes to auth state changes so the UI re-renders
// on sign-in / sign-out / token refresh.
export function useAuthUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session: Session | null) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

// Sends a magic link to `email`. The link points back to the app's origin;
// when the user clicks it, Supabase exchanges the token and onAuthStateChange
// fires with the new session.
export async function sendMagicLink(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// Instantly sign in as a fresh anonymous user. Returned session has a
// real auth.uid() (so all our RLS policies pass) but no email; the
// account exists only on this device until / unless the user later
// adds an email via supabase.auth.updateUser({ email }).
//
// Requires the project's "Anonymous Sign-Ins" toggle to be On in the
// Supabase dashboard (Auth → Providers). Returns a friendly error if
// the project hasn't enabled it.
export async function signInAnonymously(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    if (/anonymous/i.test(error.message)) {
      return {
        ok: false,
        message:
          'Anonymous sign-in is disabled on this project. Enable it in Supabase → Auth → Providers.',
      };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

// OAuth sign-in via Apple or Google. Routes to the right flow:
//   - Native iOS + provider=apple → @capacitor-community/apple-sign-in
//     plugin (Apple's policy requires native sign-in on native apps).
//   - Everything else → Supabase's web OAuth flow (browser redirect to
//     provider, redirect back to app origin, session token exchanged
//     automatically).
//
// Both providers must be enabled in the Supabase dashboard (Auth →
// Providers) with valid client credentials before they work.
// signInWithOAuth returns a friendly error pointing the user there if
// the provider isn't configured.
export type OAuthProvider = 'google' | 'apple';

export async function signInWithOAuth(
  provider: OAuthProvider,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };

  // Web OAuth flow for both providers. On iOS Capacitor this opens in
  // Safari View Controller and returns to the app via window.location
  // redirect. Native Apple sign-in via Capacitor plugin is deferred
  // until the @capacitor-community plugin supports Capacitor 8.
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    if (/provider is not enabled/i.test(error.message)) {
      return {
        ok: false,
        message: `${provider === 'apple' ? 'Apple' : 'Google'} sign-in isn't enabled on this project. Enable it in Supabase → Auth → Providers.`,
      };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

// Upgrade an anonymous (guest) user into a permanent account by linking
// an email. Supabase sends a confirmation link to the email; clicking
// it merges the existing anon user-id with the new email-based identity,
// so the user's profile, rating, friends, and games all carry over.
export async function linkEmailToAnonymous(
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
