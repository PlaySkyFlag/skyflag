// Combined account modal — handles sign-in (email magic-link), the
// first-time profile form, and signed-in profile editing. Three internal
// modes drive which form is shown; the modal is closable from any state.

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { sendMagicLink, signInAnonymously, signOut } from './game/auth';
import { loadProfile, saveProfile, type Gender, type Profile } from './game/profile';

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

  // ── Signed-out state — magic-link form ───────────────────────────────
  if (!user) {
    return (
      <div className="account-overlay" role="dialog" aria-modal="true">
        <div className="account-card">
          <div className="account-header">
            <h2 className="account-title">Sign in to SkyFlag</h2>
            <button type="button" className="account-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <p className="account-intro">
            Use a magic link to your inbox — no password to remember. Required
            only for online play; offline single-player and 2P hot-seat work
            without an account.
          </p>
          <form
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
            <label className="account-label" htmlFor="account-email">Email address</label>
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
            <button type="submit" className="end-game-btn" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
          <div className="account-divider"><span>or</span></div>
          <button
            type="button"
            className="end-game-btn end-game-btn--subtle"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage(null);
              const r = await signInAnonymously();
              setBusy(false);
              if (!r.ok) setMessage(r.message);
              // Success: onAuthStateChange in useAuthUser fires, re-renders this
              // modal in its signed-in profile-form state automatically.
            }}
            title="Skip the email step — instant guest account on this device"
          >
            {busy ? 'Signing in…' : 'Continue as guest'}
          </button>
          <p className="account-fineprint">
            Guest accounts work everywhere a normal account does, but only on
            this device — clear your browser data and you'll lose them. You
            can add an email later from this menu to make it permanent.
          </p>
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

            <label className="account-label" htmlFor="account-fullname">Full name (optional)</label>
            <input
              id="account-fullname"
              className="account-input"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nelson Jatel"
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
