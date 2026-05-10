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

// localStorage key for an in-progress profile create-form draft. Saved
// as the user types, restored when the modal re-opens. Cleared on
// successful save. Survives refresh, accidental modal close, even a
// crash mid-typing — kills the #1 "I lost my typing" failure mode.
const PROFILE_DRAFT_KEY = '3phor.profile-draft.v1';

type ProfileDraft = {
  nickname: string;
  fullName: string;
  age: string;
  gender: Gender | '';
};

function loadDraft(): ProfileDraft | null {
  try {
    const raw = localStorage.getItem(PROFILE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileDraft>;
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      age: typeof parsed.age === 'string' ? parsed.age : '',
      gender: (parsed.gender as Gender | '') ?? '',
    };
  } catch {
    return null;
  }
}

function saveDraft(d: ProfileDraft): void {
  try {
    // Don't persist empty drafts — no point cluttering storage.
    if (!d.nickname && !d.fullName && !d.age && !d.gender) {
      localStorage.removeItem(PROFILE_DRAFT_KEY);
      return;
    }
    localStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode / quota — fine to lose the draft */
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(PROFILE_DRAFT_KEY);
  } catch {
    /* no-op */
  }
}

// Cooldown (seconds) between magic-link sends. Stops accidental spam
// and rate-limit hits; the user gets a visible countdown instead.
const MAGIC_LINK_COOLDOWN_S = 30;

export default function AccountModal({ user, open, onClose, onProfileChange }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Magic-link send timestamp (ms) — used to compute the resend cooldown.
  // null means "never sent in this session" so the button is enabled.
  const [magicSentAt, setMagicSentAt] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Tick the cooldown counter once per second while it's active. The
  // button label rerenders based on cooldownLeft.
  useEffect(() => {
    if (magicSentAt === null) {
      setCooldownLeft(0);
      return;
    }
    const update = () => {
      const elapsed = Math.floor((Date.now() - magicSentAt) / 1000);
      const left = Math.max(0, MAGIC_LINK_COOLDOWN_S - elapsed);
      setCooldownLeft(left);
      if (left === 0) {
        // No need to keep ticking — interval will be cleared by the
        // dependency change.
        setMagicSentAt(null);
      }
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [magicSentAt]);

  // Profile form fields. Hydrated from existing profile if present.
  const [nickname, setNickname] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  // True after we've shown the "Restored your draft" hint at least
  // once, so the message doesn't re-fire on every re-render.
  const [draftRestored, setDraftRestored] = useState(false);

  // When the modal opens with a signed-in user, fetch their profile so we
  // know whether to show the first-time create form (empty) or the edit
  // form (pre-filled). For new users without a saved profile, also
  // restore any in-progress draft from localStorage so a refresh
  // mid-typing doesn't lose work.
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
        // No profile yet — try the localStorage draft first.
        const draft = loadDraft();
        if (draft && (draft.nickname || draft.fullName || draft.age || draft.gender)) {
          setNickname(draft.nickname);
          setFullName(draft.fullName);
          setAge(draft.age);
          setGender(draft.gender);
          if (!draftRestored) {
            setMessage('Restored your in-progress profile from last time.');
            setDraftRestored(true);
          }
        } else {
          setNickname('');
          setFullName('');
          setAge('');
          setGender('');
        }
      }
      setLoadingProfile(false);
      onProfileChange(p);
    });
  }, [open, user, onProfileChange, draftRestored]);

  // Autosave the draft as the user types. Only persist when the user
  // doesn't yet have a saved profile — for existing-user edits, we
  // don't want to leak partial edits into localStorage (the canonical
  // copy is in Supabase).
  useEffect(() => {
    if (!open || !user || profile) return;
    saveDraft({ nickname, fullName, age, gender });
  }, [open, user, profile, nickname, fullName, age, gender]);

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
              misconfigured. Visually de-emphasized.
              Resend cooldown: after sending, the button stays disabled
              with a countdown so the user doesn't double-tap (which
              hits Supabase rate-limits and produces a confusing error)
              but can resend after MAGIC_LINK_COOLDOWN_S seconds. */}
          <form
            className="account-email-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (cooldownLeft > 0) return;
              if (!email.trim()) return;
              setBusy(true);
              setMessage(null);
              const result = await sendMagicLink(email.trim());
              setBusy(false);
              if (result.ok) {
                setMessage(`✓ Magic link sent to ${email.trim()}. Check your inbox — the link expires in about an hour.`);
                setMagicSentAt(Date.now());
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
            <button
              type="submit"
              className="end-game-btn end-game-btn--subtle"
              disabled={busy || cooldownLeft > 0}
            >
              {busy
                ? 'Sending…'
                : cooldownLeft > 0
                  ? `Resend in ${cooldownLeft}s`
                  : magicSentAt
                    ? 'Resend link'
                    : 'Send magic link'}
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
                // Successful save — clear the localStorage draft. The
                // canonical copy is now in Supabase; keeping a draft
                // around would re-pre-fill the form on next open with
                // potentially stale data.
                clearDraft();
                setProfile(result.profile);
                onProfileChange(result.profile);
                setMessage('✓ Saved.');
              } else {
                // Friendly error for the unique-index violation on
                // nickname (Postgres error code 23505). Other errors
                // pass through verbatim.
                const collision =
                  /duplicate key value|unique constraint|profiles_nickname/i.test(
                    result.message,
                  );
                setMessage(
                  collision
                    ? `That nickname is already taken. Try a different one.`
                    : `Couldn't save: ${result.message}`,
                );
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
