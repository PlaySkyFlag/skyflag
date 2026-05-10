// Combined account modal — handles sign-in (email magic-link), the
// first-time profile form, and signed-in profile editing. Three internal
// modes drive which form is shown; the modal is closable from any state.

import { Capacitor } from '@capacitor/core';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  linkEmailToAnonymous,
  sendMagicLink,
  signInAnonymously,
  signInWithOAuth,
  signOut,
} from './game/auth';
import { useEntitlement } from './game/entitlements';
import { loadProfile, saveProfile, type Gender, type Profile } from './game/profile';
import { supabase } from './game/supabase';

// Stripe price ID for the Plus subscription tier. Set via env so the
// price can change (annual vs monthly, promotion windows, region-
// specific prices) without a code deploy. When unset, the upgrade
// panel hides itself entirely — useful during pre-launch.
const STRIPE_PRICE_PLUS = import.meta.env.VITE_STRIPE_PRICE_PLUS as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Props = {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onProfileChange: (profile: Profile | null) => void;
};

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export default function AccountModal({ user, open, onClose, onProfileChange }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Profile form fields. Hydrated from existing profile if present.
  const [nickname, setNickname] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // When the modal opens with a signed-in user, fetch their profile so we
  // know whether to show the first-time create form (empty) or the edit
  // form (pre-filled).
  useEffect(() => {
    if (!open || !user) return;
    setLoadingProfile(true);
    setMessage(null);
    loadProfile(user.id).then((p) => {
      setProfile(p);
      if (p) {
        setNickname(p.nickname);
        setFullName(p.full_name ?? '');
        setAge(p.age?.toString() ?? '');
        setGender(p.gender ?? '');
      } else {
        setNickname('');
        setFullName('');
        setAge('');
        setGender('');
      }
      setLoadingProfile(false);
      onProfileChange(p);
    });
  }, [open, user, onProfileChange]);

  if (!open) return null;

  // ── Signed-out state — guest-first, then OAuth, then email ──────────
  if (!user) {
    return (
      <div className="account-overlay" role="dialog" aria-modal="true">
        <div className="account-card">
          <div className="account-header">
            <h2 className="account-title">Welcome to 3phor</h2>
            <button type="button" className="account-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <p className="account-intro">
            Pick how you want to play. Online play, ratings, and tournaments
            work with any of these — guest accounts can be saved permanently
            later.
          </p>

          {/* Primary: instant guest sign-in. The dominant button because
              this is the lowest-friction path and converts best. */}
          <button
            type="button"
            className="end-game-btn account-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage(null);
              const r = await signInAnonymously();
              setBusy(false);
              if (!r.ok) setMessage(r.message);
            }}
            title="Start playing instantly — guest account on this device"
          >
            {busy ? 'Signing in…' : '▶ Continue as guest'}
          </button>
          <p className="account-primary-sub">
            No email, no password. You can save your account later.
          </p>

          <div className="account-divider"><span>or save progress across devices</span></div>

          {/* OAuth row — Apple per Apple's iOS sign-in policy + Google for
              the rest. Standard provider button styling. */}
          <div className="account-oauth-row">
            <button
              type="button"
              className="account-oauth-btn account-oauth-apple"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage(null);
                const r = await signInWithOAuth('apple');
                setBusy(false);
                if (!r.ok) setMessage(r.message);
              }}
            >
               Sign in with Apple
            </button>
            <button
              type="button"
              className="account-oauth-btn account-oauth-google"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage(null);
                const r = await signInWithOAuth('google');
                setBusy(false);
                if (!r.ok) setMessage(r.message);
              }}
            >
              <span className="account-oauth-google-glyph">G</span> Sign in with Google
            </button>
          </div>

          <div className="account-divider"><span>or use email</span></div>

          {/* Email magic-link form — kept for users without Apple/Google
              accounts and as a fallback if the OAuth providers are
              misconfigured. Visually de-emphasized. */}
          <form
            className="account-email-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email.trim()) return;
              setBusy(true);
              setMessage(null);
              const result = await sendMagicLink(email.trim());
              setBusy(false);
              if (result.ok) {
                setMessage(`✓ Magic link sent to ${email.trim()}. Check your inbox.`);
              } else {
                setMessage(`Couldn't send link: ${result.message}`);
              }
            }}
          >
            <input
              id="account-email"
              className="account-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <button type="submit" className="end-game-btn end-game-btn--subtle" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>

          {message && <p className="account-message">{message}</p>}
        </div>
      </div>
    );
  }

  // ── Signed-in state — profile create/edit form ───────────────────────
  const isFirstTime = profile === null;

  return (
    <div className="account-overlay" role="dialog" aria-modal="true">
      <div className="account-card">
        <div className="account-header">
          <h2 className="account-title">
            {isFirstTime ? 'Create your profile' : 'Your profile'}
          </h2>
          <button type="button" className="account-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="account-intro">
          {user.email ? (
            <>Signed in as <strong>{user.email}</strong>.</>
          ) : (
            <>Signed in as a <strong>guest</strong> on this device.</>
          )}{' '}
          {isFirstTime
            ? 'Pick a nickname so opponents know who they\'re playing.'
            : 'Update your profile or sign out below.'}
        </p>
        {profile && (
          <div className="account-rating">
            <div className="account-rating-cell">
              <div className="account-rating-num">{profile.rating}</div>
              <div className="account-rating-label">Rating</div>
            </div>
            <div className="account-rating-cell">
              <div className="account-rating-num">{profile.games_played}</div>
              <div className="account-rating-label">Online games</div>
            </div>
          </div>
        )}

        <PlusPanel />

        {/* Guest upgrade prompt — shown only when the signed-in user has
            no email, i.e. they're an anonymous account. Lets them link
            an email to make their rating + profile portable across
            devices without losing what they've earned. */}
        {!user.email && (
          <div className="account-upgrade-panel">
            <strong className="account-upgrade-title">Save this account</strong>
            <p className="account-upgrade-body">
              Guest accounts only live on this device — clear your browser data
              and your rating is gone. Link an email to keep your profile,
              rating, and friends across any device you sign in on.
            </p>
            <form
              className="account-email-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!email.trim()) return;
                setBusy(true);
                setMessage(null);
                const r = await linkEmailToAnonymous(email.trim());
                setBusy(false);
                if (r.ok) {
                  setMessage(`✓ Confirmation email sent to ${email.trim()}. Click the link to save your account.`);
                } else {
                  setMessage(`Couldn't link email: ${r.message}`);
                }
              }}
            >
              <input
                id="account-upgrade-email"
                className="account-input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <button type="submit" className="end-game-btn" disabled={busy}>
                {busy ? 'Sending…' : 'Save with email'}
              </button>
            </form>
          </div>
        )}
        {loadingProfile ? (
          <p className="account-message">Loading profile…</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!nickname.trim()) return;
              setBusy(true);
              setMessage(null);
              const ageNum = age === '' ? null : Number(age);
              const result = await saveProfile(user.id, {
                nickname,
                full_name: fullName || null,
                age: Number.isFinite(ageNum) ? (ageNum as number | null) : null,
                gender: gender === '' ? null : gender,
              });
              setBusy(false);
              if (result.ok) {
                setProfile(result.profile);
                onProfileChange(result.profile);
                setMessage('✓ Saved.');
              } else {
                setMessage(`Couldn't save: ${result.message}`);
              }
            }}
          >
            <label className="account-label" htmlFor="account-nickname">
              Nickname<span className="account-required"> *</span>
            </label>
            <input
              id="account-nickname"
              className="account-input"
              type="text"
              required
              minLength={2}
              maxLength={24}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. RavenCaptain"
            />

            <div className="account-row">
              <div className="account-col">
                <label className="account-label" htmlFor="account-age">Age (optional)</label>
                <input
                  id="account-age"
                  className="account-input"
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="account-col">
                <label className="account-label" htmlFor="account-gender">Gender (optional)</label>
                <select
                  id="account-gender"
                  className="account-input"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender | '')}
                >
                  <option value="">—</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="account-actions">
              <button type="submit" className="end-game-btn" disabled={busy}>
                {busy ? 'Saving…' : isFirstTime ? 'Create profile' : 'Save changes'}
              </button>
              <button
                type="button"
                className="end-game-btn end-game-btn--subtle"
                onClick={async () => {
                  await signOut();
                  onProfileChange(null);
                  onClose();
                }}
              >
                Sign out
              </button>
            </div>
          </form>
        )}
        {message && <p className="account-message">{message}</p>}
      </div>
    </div>
  );
}

// 3phor Plus subscription panel — shown to signed-in users on web who
// don't yet have the entitlement. Hidden on iOS native builds because
// Apple's App Store policy requires in-app digital subscriptions to use
// IAP, not external payment processors. iOS support is a separate
// integration via StoreKit / RevenueCat — this panel is web-only.
function PlusPanel() {
  const { hasIt: hasPlus, loading } = useEntitlement('feature.plus');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Hide entirely if:
  //   - Running on native iOS (App Store policy)
  //   - No price ID configured (pre-launch / staging without Stripe)
  //   - Loading the entitlement state (avoid flash of upgrade then "active")
  if (Capacitor.isNativePlatform()) return null;
  if (!STRIPE_PRICE_PLUS) return null;
  if (loading) return null;

  if (hasPlus) {
    return (
      <div className="account-plus-panel account-plus-active">
        <strong>★ 3phor Plus active</strong>
        <p>Thanks for supporting 3phor. All Plus features unlocked.</p>
      </div>
    );
  }

  return (
    <div className="account-plus-panel">
      <strong className="account-plus-title">3phor Plus</strong>
      <p className="account-plus-body">
        Unlock advanced AI difficulty, puzzle archive with analysis,
        custom themes, ad-free play, and unlimited tournaments.
      </p>
      <button
        type="button"
        className="end-game-btn account-plus-cta"
        disabled={busy}
        onClick={async () => {
          if (!supabase) return;
          setBusy(true);
          setErr(null);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              setErr('Sign in to subscribe.');
              setBusy(false);
              return;
            }
            const response = await fetch(
              `${SUPABASE_URL}/functions/v1/create-checkout-session`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  price_id: STRIPE_PRICE_PLUS,
                  success_url: `${window.location.origin}?plus=ok`,
                  cancel_url: window.location.origin,
                }),
              },
            );
            const body = await response.json();
            if (!response.ok || !body.url) {
              setErr(body.error ?? 'Failed to start checkout.');
              setBusy(false);
              return;
            }
            // Redirect to Stripe-hosted checkout. The user comes back
            // to ?plus=ok on success; the webhook handler will have
            // already granted the entitlement by then via realtime.
            window.location.href = body.url;
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Checkout failed.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Loading…' : 'Subscribe — $4.99/mo'}
      </button>
      {err && <p className="account-message">{err}</p>}
    </div>
  );
}
