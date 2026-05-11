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
  signOut,
  verifyEmailChangeCode,
  verifyEmailCode,
} from './game/auth';
// Note: signInWithOAuth is intentionally NOT imported — Apple/Google
// buttons are hidden until provider config is finalized. The helper
// itself stays in game/auth.ts for the eventual re-enable.
import PlusBadge from './PlusBadge';
import RatingHistory from './RatingHistory';
import { removeAvatar, uploadAvatar } from './game/avatar';
import { downloadExportFile, exportUserData } from './game/dataExport';
import { useEntitlement } from './game/entitlements';
import { loadProfile, saveProfile, type Gender, type Profile } from './game/profile';
import {
  countRemainingCodes,
  generateRecoveryCodes,
  useRecoveryCode,
} from './game/recoveryCodes';
import {
  listSessions,
  revokeAllOtherSessions,
  revokeSession,
  summarizeUserAgent,
  type SessionRow,
} from './game/sessions';
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

// Cooldown (seconds) between magic-link sends. Set to 120s (2 minutes)
// so the local cooldown comfortably outlasts Supabase Auth's server-
// side per-email throttle — at 30s users were repeatedly tripping the
// real server limit and seeing a confusing "rate limited" error
// instead of a friendly local countdown.
const MAGIC_LINK_COOLDOWN_S = 120;

// "Resend in 119s" reads awkwardly past the one-minute mark; switch to
// mm:ss once we cross 60s so a 2-minute cooldown shows "1:59" → "0:01".
function formatCooldown(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Signed-out modal has a small state machine — keeps the welcome
// screen uncluttered and gives returning users a clear, labeled
// "Sign in" path. 'choose' is the welcome screen with two CTAs;
// 'signin' is the email/OTP flow. Whether 'signin' shows the email
// input or the code input is derived from `emailSentTo` so we don't
// need a third state. Email OTP auto-creates an account for new
// emails, so the same flow serves new and returning users.
type SignedOutMode = 'choose' | 'signin';

export default function AccountModal({ user, open, onClose, onProfileChange }: Props) {
  const [mode, setMode] = useState<SignedOutMode>('choose');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Plus status — used by RatingHistory + any other Plus-gated UI here.
  // PlusPanel sub-component calls useEntitlement itself; both calls hit
  // the same context-backed cache, so this is essentially free.
  const { hasIt: hasPlus } = useEntitlement('feature.plus');

  // Magic-link send timestamp (ms) — used to compute the resend cooldown.
  // null means "never sent in this session" so the button is enabled.
  const [magicSentAt, setMagicSentAt] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // After the user sends an email, we pivot the form to "enter the
  // 6-digit code" mode. The magic link in the email still works; the
  // code input is the more robust path that doesn't depend on
  // redirect URLs or the email being clicked in the same browser.
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);

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

  // Reset the chooser → sign-in flow each time the modal closes so a
  // returning user always starts on the welcome screen instead of
  // landing back in the middle of an abandoned OTP entry.
  useEffect(() => {
    if (!open) {
      setMode('choose');
      setEmailSentTo(null);
      setCodeInput('');
      setMagicSentAt(null);
      setMessage(null);
    }
  }, [open]);

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

  // ── Signed-out state — chooser → sign-in (email + code) ─────────────
  if (!user) {
    // Welcome chooser — the default landing screen. Two clear paths:
    // start playing as a guest (one click, dominant), or sign in
    // (returning users with an existing account). Nothing else on
    // screen so the choice reads cleanly.
    if (mode === 'choose') {
      return (
        <div className="account-overlay" role="dialog" aria-modal="true">
          <div className="account-card account-card--narrow">
            <div className="account-header">
              <h2 className="account-title">Welcome to 3phor</h2>
              <button type="button" className="account-close" onClick={onClose} aria-label="Close">×</button>
            </div>

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
              {busy ? 'Signing in…' : '▶ Start playing'}
            </button>
            <p className="account-primary-sub">
              Free, no email needed. You can save your account later.
            </p>

            <div className="account-divider"><span>or</span></div>

            <button
              type="button"
              className="end-game-btn end-game-btn--subtle account-secondary"
              onClick={() => {
                setMessage(null);
                setMode('signin');
              }}
            >
              Sign in
            </button>
            <p className="account-primary-sub">
              Pick up where you left off.
            </p>

            {message && <p className="account-message">{message}</p>}
          </div>
        </div>
      );
    }

    // 'signin' mode — email → 6-digit code. Same Supabase OTP flow
    // for new and returning emails (Supabase auto-creates an account
    // if the email is unknown), so this screen serves both groups
    // even though the chooser CTA is labeled "Sign in".
    const onBack = () => {
      setMode('choose');
      setEmailSentTo(null);
      setCodeInput('');
      setMagicSentAt(null);
      setMessage(null);
    };
    return (
      <div className="account-overlay" role="dialog" aria-modal="true">
        <div className="account-card account-card--narrow">
          <div className="account-header">
            <button
              type="button"
              className="account-back"
              onClick={onBack}
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
            <h2 className="account-title">
              {emailSentTo === null ? 'Sign in' : 'Enter your code'}
            </h2>
            <button type="button" className="account-close" onClick={onClose} aria-label="Close">×</button>
          </div>

          {emailSentTo === null ? (
            <>
              <p className="account-intro">
                Enter the email tied to your account. We'll send a 6-digit
                sign-in code. New email? An account is created automatically.
              </p>
              <form
                className="account-email-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (cooldownLeft > 0) return;
                  const addr = email.trim();
                  if (!addr) return;
                  setBusy(true);
                  setMessage(null);
                  const result = await sendMagicLink(addr);
                  setBusy(false);
                  if (result.ok) {
                    setEmailSentTo(addr);
                    setMagicSentAt(Date.now());
                    setMessage(null);
                  } else {
                    setMessage(`Couldn't send: ${result.message}`);
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
                  aria-label="Email address"
                />
                <button
                  type="submit"
                  className="end-game-btn"
                  disabled={busy || cooldownLeft > 0}
                >
                  {busy
                    ? 'Sending…'
                    : cooldownLeft > 0
                      ? `Resend in ${formatCooldown(cooldownLeft)}`
                      : 'Send sign-in code'}
                </button>
              </form>
              <RecoveryCodeSignIn />
            </>
          ) : (
            <form
              className="account-email-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const code = codeInput.replace(/[^0-9]/g, '');
                if (code.length !== 6) {
                  setMessage('Code should be 6 digits — check the email.');
                  return;
                }
                setVerifying(true);
                setMessage(null);
                const r = await verifyEmailCode(emailSentTo, code);
                setVerifying(false);
                if (!r.ok) setMessage(r.message);
                // On success the auth state listener fires and the
                // modal re-renders into the signed-in branch
                // automatically — no further action needed here.
              }}
            >
              <p className="account-intro">
                We sent a code to <strong>{emailSentTo}</strong>. Type it
                below, or click the link in the email (same browser only).
              </p>
              <input
                id="account-otp"
                className="account-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 \-]*"
                maxLength={9}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="123456"
                aria-label="6-digit sign-in code"
                autoFocus
              />
              <button
                type="submit"
                className="end-game-btn"
                disabled={verifying}
              >
                {verifying ? 'Verifying…' : 'Sign in'}
              </button>
              <div className="account-actions account-actions--secondary">
                <button
                  type="button"
                  className="account-text-btn"
                  disabled={busy || cooldownLeft > 0}
                  onClick={async () => {
                    setBusy(true);
                    setMessage(null);
                    const result = await sendMagicLink(emailSentTo);
                    setBusy(false);
                    if (result.ok) {
                      setMagicSentAt(Date.now());
                      setMessage('Sent a fresh email.');
                    } else {
                      setMessage(`Couldn't resend: ${result.message}`);
                    }
                  }}
                >
                  {cooldownLeft > 0
                    ? `Resend in ${formatCooldown(cooldownLeft)}`
                    : busy
                      ? 'Sending…'
                      : 'Resend code'}
                </button>
                <span className="account-text-sep">·</span>
                <button
                  type="button"
                  className="account-text-btn"
                  onClick={() => {
                    setEmailSentTo(null);
                    setCodeInput('');
                    setMagicSentAt(null);
                    setMessage(null);
                  }}
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}

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
            <PlusBadge isPlus={profile?.is_plus} size="large" title="You're a Plus subscriber" />
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
            <AvatarUploader
              user={user}
              currentUrl={profile.avatar_url}
              onChange={(url) => setProfile({ ...profile, avatar_url: url })}
            />
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

        {/* Rating history sparkline — Plus-only. For non-subscribers
            this renders a teaser with a CTA so they see what they're
            missing without being able to inspect the data. */}
        {profile && <RatingHistory user={user} hasPlus={hasPlus} />}

        {/* Guest upgrade prompt — shown only when the signed-in user has
            no email, i.e. they're an anonymous account. Owns its own
            state machine: idle → sent (waiting on confirm-click in
            THIS browser) → user.email !== null disappears the panel
            automatically. The "this browser" warning is the load-bearing
            UX: clicking the link in a different browser silently
            orphans the guest data, since Supabase treats the click as
            a new session in that browser. */}
        {!user.email && <GuestUpgradePanel />}
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

        {/* Recovery codes — only for users with verified email, since
            the codes recover access to an email-linked account. */}
        {user.email_confirmed_at && <RecoveryCodesSection user={user} />}

        {/* Active sessions — list every device signed in to this
            account and let the user kick any of them off. Visible to
            every signed-in user (incl. guests) since hijack of a
            guest token is just as bad as hijack of an email account. */}
        <ActiveSessionsSection />

        {/* Account data — export + delete. Required for PIPEDA / App
            Store compliance. Visible to every signed-in user including
            guests; the export is useful even for ephemeral guest data
            (local stats, friends list). Delete is gated behind a
            typed confirmation to prevent accidental destruction. */}
        <AccountDataSection user={user} onAfterDelete={() => {
          onProfileChange(null);
          onClose();
        }} />

        {/* Plus pitch lives at the bottom of the modal — a soft
            reminder of what's coming for subscribers, not a wall the
            user has to scroll past to reach the actual profile form
            on first sign-up. */}
        <PlusPanel />

        {message && <p className="account-message">{message}</p>}
      </div>
    </div>
  );
}

// Guest → email-account upgrade. Three internal states:
//   idle    — show the email form with the "click in this browser" warning
//   sending — disable form while the Supabase call is in flight
//   sent    — show a waiting view: which address, resend cooldown, change-email
// Once the user clicks the confirmation link IN THIS BROWSER, Supabase
// updates user.email and onAuthStateChange fires, the parent
// re-renders, and this component is no longer mounted — no explicit
// "success" UI needed.
function GuestUpgradePanel() {
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [emailInput, setEmailInput] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [linkSentAt, setLinkSentAt] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // OTP code redemption — same email, two redemption paths.
  const [codeInput, setCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (linkSentAt === null) {
      setCooldown(0);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - linkSentAt) / 1000);
      const left = Math.max(0, MAGIC_LINK_COOLDOWN_S - elapsed);
      setCooldown(left);
      if (left === 0) setLinkSentAt(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [linkSentAt]);

  const sendLink = async (addr: string) => {
    setPhase('sending');
    setMsg(null);
    const r = await linkEmailToAnonymous(addr);
    if (r.ok) {
      setSentTo(addr);
      setLinkSentAt(Date.now());
      setPhase('sent');
    } else {
      // Friendlier copy for "already registered" — common pitfall:
      // user previously had an email account, doesn't realize it.
      const taken = /already.*registered|already.*exists|email.*taken/i.test(r.message);
      setMsg(
        taken
          ? "That email is already registered. Sign out and sign back in with it instead — note: your current guest progress won't carry over."
          : `Couldn't link email: ${r.message}`,
      );
      setPhase('idle');
    }
  };

  if (phase === 'sent') {
    return (
      <div className="account-upgrade-panel account-upgrade-sent">
        <strong className="account-upgrade-title">Check your email</strong>
        <p className="account-upgrade-body">
          We sent a confirmation to <strong>{sentTo}</strong>. Either click
          the link in the email (must be the same browser as this tab),
          {' '}<strong>or</strong> type the 6-digit code below — that
          works from any device.
        </p>
        <form
          className="account-email-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!sentTo) return;
            const code = codeInput.replace(/[^0-9]/g, '');
            if (code.length !== 6) {
              setMsg('Code should be 6 digits — check the email.');
              return;
            }
            setVerifying(true);
            setMsg(null);
            const r = await verifyEmailChangeCode(sentTo, code);
            setVerifying(false);
            if (!r.ok) {
              setMsg(r.message);
            }
            // On success the user.email field updates, the parent
            // re-renders, and this panel disappears automatically.
          }}
        >
          <input
            id="account-upgrade-otp"
            className="account-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 \-]*"
            maxLength={9}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="123456"
            aria-label="6-digit confirmation code"
          />
          <button
            type="submit"
            className="end-game-btn"
            disabled={verifying}
          >
            {verifying ? 'Verifying…' : 'Confirm with code'}
          </button>
        </form>
        <div className="account-data-actions">
          <button
            type="button"
            className="hud-btn"
            disabled={cooldown > 0}
            onClick={() => sentTo && sendLink(sentTo)}
          >
            {cooldown > 0 ? `Resend in ${formatCooldown(cooldown)}` : 'Resend'}
          </button>
          <button
            type="button"
            className="hud-btn hud-btn-subtle"
            onClick={() => {
              setPhase('idle');
              setSentTo(null);
              setLinkSentAt(null);
              setCodeInput('');
              setMsg(null);
            }}
          >
            Use a different email
          </button>
        </div>
        {msg && <p className="account-message">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="account-upgrade-panel">
      <strong className="account-upgrade-title">Save this account</strong>
      <p className="account-upgrade-body">
        Guest accounts only live on this device — clear your browser data
        and your rating is gone. Link an email to keep your profile,
        rating, and friends across any device you sign in on.
      </p>
      <form
        className="account-email-form"
        onSubmit={(e) => {
          e.preventDefault();
          const addr = emailInput.trim();
          if (!addr) return;
          sendLink(addr);
        }}
      >
        <input
          id="account-upgrade-email"
          className="account-input"
          type="email"
          required
          autoComplete="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="you@example.com"
        />
        <button
          type="submit"
          className="end-game-btn"
          disabled={phase === 'sending'}
        >
          {phase === 'sending' ? 'Sending…' : 'Save with email'}
        </button>
      </form>
      <p className="account-upgrade-foot">
        We'll send a confirmation link. <strong>Click it in this same
        browser</strong> to merge your guest account with the email.
      </p>
      {msg && <p className="account-message">{msg}</p>}
    </div>
  );
}

// Active-sessions section — shows every device signed in to the
// account, with revoke buttons for "this isn't me" panic. The
// caller's current session is marked and uses local sign-out instead
// of the revoke endpoint (so the SDK clears its own state cleanly).
//
// Three actions surface:
//   - "Sign out this device" per row (other devices only)
//   - "Sign out everywhere else" (revoke all others, keep current)
//   - "Sign out everywhere" (full global sign-out via Supabase)
function ActiveSessionsSection() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    const list = await listSessions();
    setSessions(list);
  };
  useEffect(() => {
    void refresh();
  }, []);

  const onRevoke = async (id: string) => {
    setBusy(true);
    setMsg(null);
    const r = await revokeSession(id);
    setBusy(false);
    if (!r.ok) {
      setMsg(`Couldn't sign out: ${r.message}`);
      return;
    }
    setMsg('Signed out that device.');
    void refresh();
  };

  const onRevokeOthers = async () => {
    if (!confirm('Sign out every device EXCEPT this one?')) return;
    setBusy(true);
    setMsg(null);
    const r = await revokeAllOtherSessions();
    setBusy(false);
    if (!r.ok) {
      setMsg(`Couldn't sign out others: ${r.message}`);
      return;
    }
    setMsg('Signed out every other device.');
    void refresh();
  };

  const onRevokeAll = async () => {
    if (!supabase) return;
    if (!confirm("Sign out everywhere, INCLUDING this device? You'll have to sign back in."))
      return;
    setBusy(true);
    // scope: 'global' tells Supabase to revoke every refresh token
    // for this user — including the local one, which then triggers
    // an onAuthStateChange(SIGNED_OUT) and the parent unmounts us.
    await supabase.auth.signOut({ scope: 'global' });
    setBusy(false);
  };

  return (
    <div className="account-section">
      <strong className="account-section-title">Active sessions</strong>
      <p className="account-section-body">
        Every device that's currently signed in to this account. If you
        see something you don't recognize, sign it out.
      </p>
      {sessions === null ? (
        <p className="account-message">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="account-message">No active sessions found.</p>
      ) : (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id} className="session-row">
              <div className="session-info">
                <strong>
                  {summarizeUserAgent(s.user_agent)}
                  {s.current && <span className="session-current"> · this device</span>}
                </strong>
                <span className="session-meta">
                  {s.ip ? `${s.ip} · ` : ''}
                  Last active {new Date(s.updated_at).toLocaleString()}
                </span>
              </div>
              {!s.current && (
                <button
                  type="button"
                  className="hud-btn hud-btn-subtle"
                  disabled={busy}
                  onClick={() => onRevoke(s.id)}
                >
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="account-data-actions">
        <button
          type="button"
          className="hud-btn hud-btn-subtle"
          disabled={busy || (sessions !== null && sessions.length <= 1)}
          onClick={onRevokeOthers}
        >
          Sign out everywhere else
        </button>
        <button
          type="button"
          className="hud-btn hud-btn-subtle"
          disabled={busy}
          onClick={onRevokeAll}
        >
          Sign out everywhere
        </button>
      </div>
      {msg && <p className="account-message">{msg}</p>}
    </div>
  );
}

// "Account data" section — separate component to keep AccountModal's
// state tidy. Owns its own busy/message state for export and delete.
function AccountDataSection({
  user,
  onAfterDelete,
}: {
  user: User;
  onAfterDelete: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const onExport = async () => {
    setExporting(true);
    setLocalMsg(null);
    try {
      const bundle = await exportUserData(user);
      downloadExportFile(bundle);
      setLocalMsg('✓ Export started — check your downloads folder.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      setLocalMsg(`Couldn't export: ${msg}`);
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    if (confirmText.trim().toLowerCase() !== 'delete') {
      setLocalMsg('Type DELETE in the box to confirm.');
      return;
    }
    if (!supabase) return;
    setDeleting(true);
    setLocalMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: {},
      });
      if (error) throw new Error(error.message);
      if (data && data.ok === false) throw new Error(data.error ?? 'Delete failed.');
      // Sign out locally — the server has already invalidated the
      // auth row; this clears the local session and triggers the
      // onAuthStateChange listeners that re-render the app as
      // signed-out.
      await signOut();
      onAfterDelete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed.';
      setLocalMsg(`Couldn't delete: ${msg}`);
      setDeleting(false);
    }
  };

  return (
    <div className="account-data-section">
      <h3 className="account-data-title">Your account data</h3>
      <p className="account-data-body">
        Download everything we have on you, or delete your account.
        Required by privacy law — and good practice.
      </p>
      <div className="account-data-actions">
        <button
          type="button"
          className="hud-btn"
          onClick={onExport}
          disabled={exporting || deleting}
        >
          {exporting ? 'Preparing…' : '↓ Download my data'}
        </button>
        {!confirming ? (
          <button
            type="button"
            className="hud-btn hud-btn-warn"
            onClick={() => {
              setConfirming(true);
              setLocalMsg(null);
            }}
            disabled={deleting}
          >
            Delete my account
          </button>
        ) : (
          <div className="account-delete-confirm">
            <p className="account-delete-warning">
              <strong>This is permanent.</strong> Your profile, rating,
              friends, and tournament entries will be wiped. Game records
              survive but your name is removed from them. Any active
              Plus subscription is cancelled. Type <code>DELETE</code>{' '}
              below to confirm.
            </p>
            <input
              type="text"
              className="account-input"
              placeholder="Type DELETE to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
            <div className="account-data-actions">
              <button
                type="button"
                className="hud-btn hud-btn-warn"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                type="button"
                className="hud-btn hud-btn-subtle"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText('');
                  setLocalMsg(null);
                }}
                disabled={deleting}
              >
                Keep my account
              </button>
            </div>
          </div>
        )}
      </div>
      {localMsg && <p className="account-message">{localMsg}</p>}
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

// Avatar uploader — picker + preview circle. Sits next to the rating
// cells in the signed-in profile header. File goes to Supabase Storage
// (RLS scopes writes by path prefix); profile row stores the public URL.
function AvatarUploader({
  user,
  currentUrl,
  onChange,
}: {
  user: User;
  currentUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setErr(null);
    const r = await uploadAvatar(user.id, file);
    setBusy(false);
    if (r.ok) onChange(r.url);
    else setErr(r.message);
  };

  const handleRemove = async () => {
    setBusy(true);
    setErr(null);
    const r = await removeAvatar(user.id);
    setBusy(false);
    if (r.ok) onChange(null);
    else setErr(r.message);
  };

  return (
    <div className="account-avatar-cell">
      <label className="account-avatar-circle">
        {currentUrl ? (
          <img src={currentUrl} alt="Your avatar" />
        ) : (
          <span className="account-avatar-placeholder" aria-hidden="true">?</span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          disabled={busy}
          style={{ display: 'none' }}
        />
        <span className="account-avatar-overlay">
          {busy ? '…' : currentUrl ? 'Change' : 'Upload'}
        </span>
      </label>
      {currentUrl && !busy && (
        <button
          type="button"
          className="hud-btn hud-btn-subtle account-avatar-remove"
          onClick={handleRemove}
          title="Remove avatar"
        >
          Remove
        </button>
      )}
      {err && <p className="account-message account-avatar-error">{err}</p>}
    </div>
  );
}

// Recovery-codes panel — shows how many codes the user has left and
// lets them generate a fresh set. The plaintext codes appear ONCE in
// a one-time view; we tell the user explicitly that this is their only
// chance to save them.
function RecoveryCodesSection({ user }: { user: User }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [shown, setShown] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    countRemainingCodes(user.id).then(setRemaining);
  }, [user.id]);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    const r = await generateRecoveryCodes();
    setBusy(false);
    setConfirming(false);
    if (r.ok) {
      setShown(r.codes);
      setRemaining(r.codes.length);
    } else {
      setErr(r.message);
    }
  };

  const downloadCodes = () => {
    if (!shown) return;
    const text =
      `3phor recovery codes — generated ${new Date().toLocaleString()}\n` +
      `Account: ${user.email}\n\n` +
      shown.map((c, i) => `${i + 1}.  ${c}`).join('\n') +
      `\n\nStore these somewhere safe. Each code can only be used once,\n` +
      `and you'll need both the code and your email to recover access.\n`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3phor-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="account-data-section">
      <h3 className="account-data-title">Recovery codes</h3>
      <p className="account-data-body">
        One-shot codes that let you sign back in if you lose access to
        your email. {remaining !== null && (
          <strong>{remaining} of 8 active.</strong>
        )}
      </p>

      {shown ? (
        <div className="account-recovery-shown">
          <p className="account-upgrade-warning">
            ⚠ <strong>Save these now.</strong> They won't be shown
            again. Generating new codes invalidates any previous set.
          </p>
          <ol className="account-recovery-list">
            {shown.map((c, i) => (
              <li key={i}><code>{c}</code></li>
            ))}
          </ol>
          <div className="account-data-actions">
            <button type="button" className="hud-btn" onClick={downloadCodes}>
              ↓ Download as text file
            </button>
            <button
              type="button"
              className="hud-btn hud-btn-subtle"
              onClick={() => setShown(null)}
            >
              I've saved them
            </button>
          </div>
        </div>
      ) : confirming ? (
        <div className="account-delete-confirm">
          <p className="account-delete-warning">
            Generating new codes invalidates your previous set. If
            you've already shared or saved old codes, those will stop
            working immediately.
          </p>
          <div className="account-data-actions">
            <button
              type="button"
              className="hud-btn hud-btn-warn"
              onClick={generate}
              disabled={busy}
            >
              {busy ? 'Generating…' : 'Generate new codes'}
            </button>
            <button
              type="button"
              className="hud-btn hud-btn-subtle"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="account-data-actions">
          <button
            type="button"
            className="hud-btn"
            onClick={() => (remaining === 0 ? generate() : setConfirming(true))}
            disabled={busy}
          >
            {remaining === 0 ? 'Generate codes' : 'Generate new codes'}
          </button>
        </div>
      )}
      {err && <p className="account-message">{err}</p>}
    </div>
  );
}

// "Locked out? Use a recovery code" path — shown in the signed-out
// AccountModal alongside the magic-link form. Calls use-recovery-code,
// then navigates the browser to the issued action_link which signs
// the user back in.
function RecoveryCodeSignIn() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <p className="account-recovery-toggle">
        Locked out of your email?{' '}
        <button
          type="button"
          className="account-link-button"
          onClick={() => setOpen(true)}
        >
          Use a recovery code →
        </button>
      </p>
    );
  }

  return (
    <form
      className="account-recovery-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!email.trim() || !code.trim()) return;
        setBusy(true);
        setErr(null);
        const r = await useRecoveryCode(email.trim(), code.trim());
        if (r.ok) {
          // Navigate to the action_link — Supabase Auth picks it up,
          // issues a session, and onAuthStateChange flips the modal
          // into the signed-in profile view.
          window.location.href = r.actionLink;
        } else {
          setErr(r.message);
          setBusy(false);
        }
      }}
    >
      <p className="account-data-body">
        Enter your email and one of the recovery codes you saved when
        you set up your account.
      </p>
      <input
        type="email"
        className="account-input"
        placeholder="you@example.com"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="text"
        className="account-input"
        placeholder="XXXX-XXXX-XXXX-XXXX"
        autoComplete="off"
        spellCheck={false}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <div className="account-data-actions">
        <button type="submit" className="end-game-btn" disabled={busy}>
          {busy ? 'Verifying…' : 'Sign in with code'}
        </button>
        <button
          type="button"
          className="hud-btn hud-btn-subtle"
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
      {err && <p className="account-message">{err}</p>}
    </form>
  );
}
