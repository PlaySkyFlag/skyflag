// Supabase Auth wrapper. Three sign-in methods supported:
//   - Email magic link (works everywhere, no extra config)
//   - Anonymous (instant guest, requires the Supabase anon-sign-in toggle)
//   - OAuth (Apple/Google) — web flow via Supabase's built-in OAuth on
//     browsers; native flow via @capacitor-community/apple-sign-in on
//     iOS so we satisfy Apple's "must use native sign-in for native apps"
//     App Store requirement.

import { Capacitor } from '@capacitor/core';
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

  // iOS native app + Apple → use the native plugin so we get the system
  // sign-in sheet, biometric/passcode prompt, and Apple's full UX.
  if (provider === 'apple' && Capacitor.isNativePlatform()) {
    return signInWithAppleNative();
  }

  // Everything else: web OAuth flow.
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

// Native iOS Sign in with Apple — uses the @capacitor-community plugin
// to surface Apple's system sign-in sheet, then trades the resulting
// identity token for a Supabase session via signInWithIdToken.
//
// The plugin is lazy-imported so the web bundle doesn't pull in
// native-only code paths it would never use.
async function signInWithAppleNative(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };

  try {
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');

    const result = await SignInWithApple.authorize({
      // Bundle identifier of the iOS app. Apple uses this to bind the
      // sign-in to the app on their side.
      clientId: 'com.limnology.skyflag',
      // Required by the plugin's API even for native flow (where it's
      // unused). Set to the Supabase callback for consistency.
      redirectURI: 'https://oeychcbxvuozkvfjcwlr.supabase.co/auth/v1/callback',
      scopes: 'email name',
    });

    const idToken = result.response.identityToken;
    if (!idToken) {
      return { ok: false, message: 'Apple did not return an identity token.' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sign in with Apple failed.';
    // User-cancel is the most common "error" — surface as a no-op
    // rather than an alarming error message.
    if (/canceled|cancelled/i.test(msg)) {
      return { ok: false, message: 'Cancelled.' };
    }
    return { ok: false, message: msg };
  }
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
