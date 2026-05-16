// ThresanStudio — served at thresan.studio. Per the launch plan this is
// the reader's home: the canonical place to find Issue One, meet the
// world, hear from the creator, and convert into either playing Skyflag
// now or joining the Kickstarter list. It is intentionally the deepest
// of the thresan.* surfaces (.com stays the short universe umbrella;
// .games the catalog; .store the physical edition). Same gold-on-dark
// palette so the brand reads as one thing across every domain.
//
// The issue card links to the dedicated /volume-zero landing. Volume
// Zero art does not exist yet, so everything renders an honest
// "in production" state and lights up from volumeZeroPages.ts.

import { useEffect, useState, type FormEvent } from 'react';
import './ThresanStudio.css';
import { applySurfaceMeta } from './socialMeta';
import { supabase } from './game/supabase';
import {
  VOLUME_ZERO,
  VOLUME_ZERO_PAGES,
  VOLUME_ZERO_PDF,
  VOLUME_ZERO_ISBN,
  VOLUME_ZERO_PUBLICATION_READY,
} from './volumeZeroPages';

const GAME_URL = 'https://www.playskyflag.com/?ref=thresan-studio';
const READ_URL = '/volume-zero';
const STORE_URL = 'https://thresan.store';
const GAMES_URL = 'https://thresan.games';
const UMBRELLA_URL = 'https://thresan.com';
const LINKEDIN_URL = 'https://ca.linkedin.com/in/nelsonjatel';

// ─── World content (all grounded in existing repo canon: ThresanGames
// for clans/pieces, ThresanIO for the Lifts / Ashtapada / Nexus). Kept
// deliberately spare — the full bios arrive with Issue One's pages. ────

const CLANS = [
  {
    name: 'The Grey Ravens',
    line: 'One of the two clans of Kaleo contesting the Caelum Nexus. Full identity expands with Issue One.',
  },
  {
    name: 'The White Stags',
    line: 'The opposing clan. Same proof, opposite reach. Full identity expands with Issue One.',
  },
];

// Five pieces a side (Captain, Soldier, Promoted Soldier Captain,
// Rover, Pilot) — canonical per rulebook v20. The Soldier promotes, so
// Durren is two of the five: Soldier Durren, then Captain Durren.
const PIECES = [
  {
    name: 'Captain Dantec',
    line: 'The Captain. The proof rides on this piece — land your Captain on the Caelum Nexus and the game is won.',
  },
  {
    name: 'Soldier Durren',
    line: 'The Soldier. Advances and, at the far rank, promotes.',
  },
  {
    name: 'Captain Durren',
    line: 'The Promoted Soldier Captain — the swap-in Durren becomes on promotion. The fifth piece, and why a side counts five.',
  },
  {
    name: 'Rover Thandiwe',
    line: 'The Rover — a transport between layers, leap-captures up close. Full bio lands with Issue One.',
  },
  {
    name: 'Pilot Voss',
    line: 'The Pilot — a transport between layers, leap-captures up close. Full bio lands with Issue One.',
  },
];

const FRAGMENTS = [
  {
    name: 'The Lifts',
    line: 'Fixed positions at (1,1), (1,4), (4,1), (4,4) — the only way a piece changes planes. No free transit; the third dimension is a strategic asset, not noise.',
  },
  {
    name: 'Ashtapada',
    line: 'The eight-by-eight board predates chess by centuries. Ashtapada — Sanskrit for "eight-footed" — is the ancestor. Thresan keeps the disciplined grid and lifts it into three dimensions.',
  },
  {
    name: 'The Caelum Nexus',
    line: 'A single column at the centre of the stack. Land your Captain there and the proof is complete. One column, one win path — by design.',
  },
];

export default function ThresanStudio() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'Thresan™ — read Issue One free · Skyflag',
      description:
        'The reader’s home for Thresan: Skyflag. Read Issue One free, ' +
        'meet the world of Kaleo, and play Skyflag now — built by ' +
        'Nelson Jatel in Kelowna, BC.',
      canonicalUrl: 'https://thresan.studio/',
      ogImage: 'https://thresan.studio/thresan-og-studio.jpg',
      ogImageAlt: 'The world of Thresan — Issue One, the studio behind Skyflag.',
    });
  }, []);

  const hasPages = VOLUME_ZERO_PAGES.length > 0;
  const issueStatus = VOLUME_ZERO_PUBLICATION_READY
    ? 'Publication-ready'
    : hasPages
      ? 'First pages live'
      : VOLUME_ZERO_ISBN
        ? 'Registered · in production'
        : 'In production';

  return (
    <div className="studio">
      <main className="studio-inner">
        <img src="/3phor-logo.png" alt="" className="studio-sigil" />
        <p className="studio-eyebrow">The reader&rsquo;s home</p>
        <h1 className="studio-name">
          THRESAN<span className="studio-suffix">.studio</span>
        </h1>
        <p className="studio-tagline tagline-script">{VOLUME_ZERO.tagline}</p>
        <p className="studio-lead">
          The world of Kaleo behind the current edition of{' '}
          <em>Thresan: Skyflag</em> — read it here, then play it.
        </p>

        {/* ── Issue One ─────────────────────────────────────────── */}
        <section className="studio-card" aria-labelledby="vz-title">
          <p className="studio-card-status">{issueStatus}</p>
          <h2 id="vz-title" className="studio-card-title">
            {VOLUME_ZERO.shortTitle}
          </h2>
          <p className="studio-card-body">{VOLUME_ZERO.synopsis}</p>
          {VOLUME_ZERO_ISBN && (
            <p className="studio-card-isbn">
              {VOLUME_ZERO.registeredTitle} · {VOLUME_ZERO.publisher} ·{' '}
              {VOLUME_ZERO.format} · ISBN {VOLUME_ZERO_ISBN}
            </p>
          )}
          <div className="studio-card-actions">
            <a href={READ_URL} className="studio-cta">
              {hasPages ? 'Read Issue One free →' : 'Open Issue One →'}
            </a>
            {VOLUME_ZERO_PDF && (
              <a href={VOLUME_ZERO_PDF} className="studio-link" download>
                Download PDF →
              </a>
            )}
          </div>
        </section>

        {/* ── The world ────────────────────────────────────────── */}
        <section className="studio-section" aria-labelledby="world-title">
          <h2 id="world-title" className="studio-section-title">
            The clans
          </h2>
          <ul className="studio-profiles">
            {CLANS.map((c) => (
              <li key={c.name} className="studio-profile">
                <h3 className="studio-profile-name">{c.name}</h3>
                <p className="studio-profile-line">{c.line}</p>
              </li>
            ))}
          </ul>

          <h2 className="studio-section-title">The pieces</h2>
          <p className="studio-section-note">
            Five pieces a side — the Soldier promotes, so Durren is two
            of them: Soldier Durren, then Captain Durren.
          </p>
          <ul className="studio-profiles">
            {PIECES.map((p) => (
              <li key={p.name} className="studio-profile">
                <h3 className="studio-profile-name">{p.name}</h3>
                <p className="studio-profile-line">{p.line}</p>
              </li>
            ))}
          </ul>

          <h2 className="studio-section-title">The world</h2>
          <ul className="studio-profiles">
            {FRAGMENTS.map((f) => (
              <li key={f.name} className="studio-profile">
                <h3 className="studio-profile-name">{f.name}</h3>
                <p className="studio-profile-line">{f.line}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Creator notes ────────────────────────────────────── */}
        <section className="studio-section" aria-labelledby="creator-title">
          <h2 id="creator-title" className="studio-section-title">
            From the studio
          </h2>
          <img
            src="/nelson-jatel.jpg"
            alt="Portrait of Nelson Jatel"
            className="studio-portrait"
            width={140}
            height={140}
          />
          <div className="studio-prose">
            <p>
              Thresan is built by <strong>Nelson Jatel</strong> in
              Kelowna, BC. By day I support watershed management and am
              an adjunct professor at UBCO — limnologist and doctor of
              social sciences.
            </p>
            <p>
              Thresan came from somewhere else entirely. My two brothers
              and I have spent every holiday for as long as I can
              remember around a board game. Three of us, the same table.{' '}
              <em>Three worlds. One proof.</em> is, in the end, a
              sentence about us. <em>Skyflag</em> is its current edition,
              built solo on evenings and weekends, with my brothers and
              friends as the first playtesters.
            </p>
            <p className="studio-prose-note">
              An AI-use disclosure ships with Issue One&rsquo;s first
              pages — see <code>AI_USE_DISCLOSURE</code> in
              ThresanStudio.tsx for the draft awaiting the creator&rsquo;s
              sign-off.
            </p>
          </div>
        </section>

        {/* ── Convert ──────────────────────────────────────────── */}
        <a href={GAME_URL} className="studio-cta studio-cta-wide">
          Play Skyflag now →
        </a>

        <KickstarterList />

        <div className="studio-secondary">
          <a href={GAMES_URL} className="studio-link">
            The editions (thresan.games) →
          </a>
          <a href={STORE_URL} className="studio-link">
            The physical edition (thresan.store) →
          </a>
          <a href={UMBRELLA_URL} className="studio-link">
            The universe (thresan.com) →
          </a>
          <a
            href={LINKEDIN_URL}
            className="studio-link"
            target="_blank"
            rel="noreferrer"
          >
            Day-job résumé (LinkedIn) →
          </a>
        </div>

        <p className="studio-fineprint">
          Thresan™ is a project of Limnology Research Corp. ·{' '}
          <a href="https://playskyflag.com/privacy">Privacy</a> ·{' '}
          <a href="https://playskyflag.com/terms">Terms</a>
        </p>
      </main>
    </div>
  );
}

// ─── Kickstarter list ──────────────────────────────────────────────
// Reuses the proven ThresanStore waitlist pattern against the same
// thresan_waitlist table, tagged source: 'thresan-studio-kickstarter'
// so signups from the reader's home are attributable. 23505 (duplicate)
// is treated as success so the form can't be used to probe which
// emails are already on the list.

function KickstarterList() {
  const [email, setEmail] = useState('');
  const [status, setStatus] =
    useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setStatus('error');
      setError('Please enter a valid email.');
      return;
    }
    if (!supabase) {
      setStatus('error');
      setError("Couldn't reach the list right now. Please try again later.");
      return;
    }
    setStatus('submitting');
    setError('');
    const { error: insertError } = await supabase
      .from('thresan_waitlist')
      .insert({
        email: trimmed,
        source: 'thresan-studio-kickstarter',
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      });
    if (insertError && insertError.code !== '23505') {
      setStatus('error');
      setError("Couldn't save your email. Please try again.");
      return;
    }
    setStatus('success');
  };

  return (
    <section className="studio-ks" aria-labelledby="ks-title">
      <h2 id="ks-title" className="studio-ks-title">
        Join the Kickstarter list
      </h2>
      <p className="studio-ks-lead">
        One email when the campaign goes live, plus first look at new
        Issue One pages. That&rsquo;s all the list is for.
      </p>
      {status === 'success' ? (
        <div
          className="studio-ks-success"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong>You&rsquo;re on the list.</strong> We&rsquo;ll be in
          touch when the campaign launches.
        </div>
      ) : (
        <form className="studio-ks-form" onSubmit={handleSubmit} noValidate>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="studio-ks-input"
            disabled={status === 'submitting'}
            required
            aria-label="Email address"
          />
          <button
            type="submit"
            className="studio-cta"
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Joining…' : 'Join the list'}
          </button>
          {status === 'error' && (
            <p className="studio-ks-error">{error}</p>
          )}
        </form>
      )}
    </section>
  );
}

// ─── AI-use disclosure (DRAFT — not yet rendered) ──────────────────
// Gated off the page until the creator finalizes it. GlobalComix and
// Kickstarter both have AI-disclosure norms; publishing an inaccurate
// statement is worse than deferring one. Nelson: edit this to match
// your actual process, then wire it into the "From the studio" section
// (replace the studio-prose-note paragraph) once it is true and final.
// Intentionally exported-as-comment, not live copy, so nothing
// unverified can ship by accident.
export const AI_USE_DISCLOSURE = `
[DRAFT — pending creator sign-off]
Issue One was [written / thumbnailed / lettered / colored] by Nelson
Jatel. AI tools were [used for: ... / not used for: ...]. Specifics:
[name tools and the exact step each was used in]. Final creative
decisions and the published pages are the author's.
`;
