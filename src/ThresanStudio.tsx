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
const GLOBALCOMIX_URL =
  'https://globalcomix.com/read/650af4e6-1570-4196-87b3-fa8072e25dfb/1?utm_source=Link&utm_medium=Referral&utm_campaign=thresan&utm_term=GCRID_370744';
const STORE_URL = 'https://thresan.store';
const GAMES_URL = 'https://thresan.games';
const UMBRELLA_URL = 'https://thresan.com';
const LINKEDIN_URL = 'https://ca.linkedin.com/in/nelsonjatel';

// ─── World content. Clans + the Captain are now grounded in the
// PUBLISHED Issue One (back cover names "Captains Renn Dantec of the
// Grey Ravens and Sera Dantec of the White Stags"). The other roster
// roles (Durren, Thandiwe, Voss) are rulebook-v20 canon and are not
// featured in Issue One, so they're stated as game roles, no story
// promise. ────────────────────────────────────────────────────────

const CLANS = [
  {
    name: 'The Grey Ravens',
    line: 'Captain Renn Dantec’s clan. In Issue One she works the Second Epoch archives and turns up the eight-footed mark — the Ashtapada-marked Aetheri leaf the First Clan left waiting before the Nexus shifted.',
  },
  {
    name: 'The White Stags',
    line: 'Captain Sera Dantec’s clan. When the mark surfaces she sounds the mobilization, then descends with Renn into the hidden First Clan infrastructure beneath Kaleo.',
  },
];

// Five pieces a side (Captain, Soldier, Promoted Soldier Captain,
// Rover, Pilot) — canonical per rulebook v20. The Soldier promotes, so
// Durren is two of the five: Soldier Durren, then Captain Durren.
const PIECES = [
  {
    name: 'Captain Dantec',
    line: 'The Captain — the piece the proof rides on; land it on the Caelum Nexus to win. Each clan fields a Dantec: Renn Dantec leads the Grey Ravens, Sera Dantec the White Stags.',
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
    line: 'The Rover — one of the clan’s two transports between layers; leap-captures up close.',
  },
  {
    name: 'Pilot Voss',
    line: 'The Pilot — the clan’s other transport between layers; leap-captures up close.',
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
    name: 'The eight-footed mark',
    line: 'The Ashtapada glyph as an in-world relic — an Aetheri leaf the First Clan left in the Kaleo archives. Issue One is its discovery, and its warning: it was never a game.',
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
      title: 'Read Chapter 1 free — Thresan: Skyflag',
      description:
        'Get Chapter 1 of the Thresan: Skyflag graphic prequel, free. ' +
        'Enter your email and read it online, on GlobalComix, or as a ' +
        'PDF — then play the game.',
      canonicalUrl: 'https://thresan.studio/',
      ogImage: 'https://thresan.studio/volume-zero/TH_VolumeZero_00_Cover.jpg',
      ogImageAlt:
        'Cover of Thresan: Skyflag — Chapter 1: The Eight-Footed Mark. Renn Dantec of the Grey Ravens and Sera Dantec of the White Stags before the stone guardian, the Aetheri leaf glowing between them.',
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

        {/* Single above-the-fold job: capture the email in exchange for
            the free comic. Everything else is below the fold. */}
        <ChapterOneGate />

        {/* ── Chapter 1 ─────────────────────────────────────────── */}
        <section className="studio-card" aria-labelledby="vz-title">
          <p className="studio-card-status">{issueStatus}</p>
          <h2 id="vz-title" className="studio-card-title">
            {VOLUME_ZERO.marketingTitle}
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
              {hasPages ? 'Read Chapter 1 free →' : 'Open Chapter 1 →'}
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
          <a href="https://playskyflag.com/terms">Terms</a> ·{' '}
          <a href="https://playskyflag.com/ai-use">AI use</a>
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

// ─── Chapter 1 gate ────────────────────────────────────────────────
// The single above-the-fold job on thresan.studio: trade an email for
// the free comic. Nothing sells yet — the list is the asset. Same
// proven thresan_waitlist pattern, tagged source 'thresan-studio-
// chapter1'. On success the read options are revealed (online,
// GlobalComix, PDF) so the subscriber gets the comic immediately —
// the email is the ask, not a wall.

function ChapterOneGate() {
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
        source: 'thresan-studio-chapter1',
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
    <section className="studio-gate" aria-labelledby="gate-title">
      <h2 id="gate-title" className="studio-gate-headline">
        Read Chapter 1 free
      </h2>
      <p className="studio-gate-lead">
        <em>{VOLUME_ZERO.marketingTitle}</em> — the graphic prequel to
        Thresan: Skyflag. Enter your email and read it now. One email
        when Chapter 2 and the Kickstarter land. Nothing else.
      </p>
      {status === 'success' ? (
        <div
          className="studio-gate-done"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <p>
            <strong>You&rsquo;re in.</strong> Read Chapter 1:
          </p>
          <div className="studio-gate-actions">
            <a href={READ_URL} className="studio-cta">
              Read online →
            </a>
            <a
              href={GLOBALCOMIX_URL}
              className="studio-link"
              target="_blank"
              rel="noreferrer"
            >
              Read on GlobalComix →
            </a>
            {VOLUME_ZERO_PDF && (
              <a href={VOLUME_ZERO_PDF} className="studio-link" download>
                Download PDF →
              </a>
            )}
          </div>
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
            {status === 'submitting' ? 'Sending…' : 'Get Chapter 1 free'}
          </button>
          {status === 'error' && (
            <p className="studio-ks-error">{error}</p>
          )}
        </form>
      )}
      <a href={READ_URL} className="studio-gate-skip">
        or just start reading →
      </a>
    </section>
  );
}
