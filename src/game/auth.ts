// Supabase Auth wrapper. Email magic-link is the only sign-in method —
// simplest UX for tester/casual players (no passwords to forget) and
// no extra provider config (works out of the box with default Supabase
// project email).

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
