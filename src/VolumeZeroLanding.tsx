// VolumeZeroLanding — served at thresan.studio/volume-zero (and the
// /the-eight-footed-mark alias). The conversion surface for the prequel.
// Goal is NOT comic revenue: it is reader → player → email subscriber →
// Kickstarter backer. Structure follows the creator's spec exactly:
// title, subtitle, four buttons, synopsis, cover, page-by-page reader,
// imprint note, copyright block, transparent AI-use statement, game
// link, Kickstarter signup.

import { useEffect, useState, type FormEvent } from 'react';
import './VolumeZeroLanding.css';
import { applySurfaceMeta } from './socialMeta';
import { supabase } from './game/supabase';
import VolumeZeroReader from './VolumeZeroReader';
import {
  VOLUME_ZERO,
  VOLUME_ZERO_COVER,
  VOLUME_ZERO_PDF,
  VOLUME_ZERO_ISBN,
  VOLUME_ZERO_COPYRIGHT,
} from './volumeZeroPages';

const GAME_URL = 'https://www.playskyflag.com/?ref=thresan-volume-zero';

// Transparent AI-use statement. Until the creator finalizes the
// detailed wording, the page shows a verifiably-true baseline with NO
// tool names or process specifics — nothing unverified ships to a live
// page. Nelson: replace AI_USE_PUBLIC with your finalized statement
// (use AI_USE_DRAFT as the starting point) and set AI_USE_FINAL = true.
const AI_USE_FINAL = false;
const AI_USE_PUBLIC =
  'Volume Zero is an original story by Dr. Nelson Jatel, set in the ' +
  'original world of Thresan™. A full AI-use disclosure is published ' +
  'together with the issue’s pages.';
// Draft kept in code only — contains a bracketed TODO, so it must not
// render publicly until finalized.
const AI_USE_DRAFT =
  'Volume Zero is an original story written by Dr. Nelson Jatel. ' +
  'Artwork was produced with AI image-generation tools under the ' +
  'author’s art direction; the author made final selections, edits, ' +
  'lettering, and layout, and reviewed every page. [Nelson: confirm ' +
  'the exact tools and the steps each was used in before launch.] ' +
  'All characters, world, and trademarks are original to Thresan™.';
const AI_USE_STATEMENT = AI_USE_FINAL ? AI_USE_DRAFT : AI_USE_PUBLIC;

export default function VolumeZeroLanding() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: `${VOLUME_ZERO.shortTitle} · Thresan: Skyflag`,
      description: VOLUME_ZERO.subtitle + ' ' + VOLUME_ZERO.synopsis,
      canonicalUrl: 'https://thresan.studio/volume-zero',
      ogImage: 'https://thresan.studio/thresan-og-clans.jpg',
      ogImageAlt:
        'Three stacked boards with Grey Ravens and White Stags arrayed across all three planes.',
    });
  }, []);

  return (
    <div className="vzl">
      <main className="vzl-inner">
        <header className="vzl-hero">
          <p className="vzl-eyebrow tagline-script">{VOLUME_ZERO.tagline}</p>
          <h1 className="vzl-title">{VOLUME_ZERO.title}</h1>
          <p className="vzl-subtitle">{VOLUME_ZERO.subtitle}</p>

          <div className="vzl-buttons">
            <a href="#reader" className="vzl-btn vzl-btn--primary">
              Read online
            </a>
            {VOLUME_ZERO_PDF ? (
              <a href={VOLUME_ZERO_PDF} className="vzl-btn" download>
                Download PDF
              </a>
            ) : (
              <span className="vzl-btn vzl-btn--disabled" aria-disabled="true">
                PDF — coming
              </span>
            )}
            <a href={GAME_URL} className="vzl-btn">
              Play Skyflag
            </a>
            <a href="#kickstarter" className="vzl-btn">
              Join the Kickstarter list
            </a>
          </div>
        </header>

        <section className="vzl-overview">
          <div className="vzl-cover">
            {VOLUME_ZERO_COVER ? (
              <img
                src={VOLUME_ZERO_COVER}
                alt={`Cover — ${VOLUME_ZERO.shortTitle}`}
                className="vzl-cover-img"
              />
            ) : (
              <div className="vzl-cover-placeholder" aria-hidden="true">
                <img src="/3phor-logo.png" alt="" className="vzl-cover-sigil" />
                <span>Cover in production</span>
              </div>
            )}
          </div>
          <div className="vzl-synopsis">
            <h2 className="vzl-h2">The story</h2>
            <p>{VOLUME_ZERO.synopsis}</p>
            <p className="vzl-imprint">
              Published by {VOLUME_ZERO.publisher} under the{' '}
              {VOLUME_ZERO.imprint} imprint.
            </p>
          </div>
        </section>

        {/* Page-by-page reader (embedded, page-based — not webtoon). */}
        <section id="reader" className="vzl-reader" aria-label="Read Volume Zero">
          <h2 className="vzl-h2">Read it</h2>
          <VolumeZeroReader embedded />
        </section>

        {/* Conversion: play the game now. */}
        <section className="vzl-play">
          <h2 className="vzl-h2">The world is a game you can play right now</h2>
          <a href={GAME_URL} className="vzl-btn vzl-btn--primary">
            Play Skyflag at playskyflag.com →
          </a>
        </section>

        {/* Conversion: the email list. */}
        <KickstarterSignup />

        <footer className="vzl-foot">
          <h2 className="vzl-h2">AI-use statement</h2>
          <p className="vzl-aiuse">{AI_USE_STATEMENT}</p>

          <p className="vzl-colophon">
            {VOLUME_ZERO.author} · {VOLUME_ZERO.publisher} ·{' '}
            {VOLUME_ZERO.imprint}
            {VOLUME_ZERO_ISBN && (
              <>
                {' '}· ISBN {VOLUME_ZERO_ISBN} (registered as{' '}
                <em>{VOLUME_ZERO.registeredTitle}</em>)
              </>
            )}
          </p>
          <p className="vzl-copyright">{VOLUME_ZERO_COPYRIGHT}</p>
          <p className="vzl-fineprint">
            <a href={GAME_URL}>Play Skyflag</a> ·{' '}
            <a href="https://playskyflag.com/privacy">Privacy</a> ·{' '}
            <a href="https://playskyflag.com/terms">Terms</a>
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─── Kickstarter signup ────────────────────────────────────────────
// Same proven thresan_waitlist pattern; tagged so Volume Zero signups
// are attributable. 23505 (duplicate) treated as success.

function KickstarterSignup() {
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
        source: 'thresan-volume-zero-kickstarter',
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
    <section id="kickstarter" className="vzl-ks" aria-labelledby="vzl-ks-title">
      <h2 id="vzl-ks-title" className="vzl-h2">
        Join the Kickstarter list
      </h2>
      <p className="vzl-ks-lead">
        One email when the campaign goes live, plus new Volume Zero
        pages as they post. That&rsquo;s all the list is for.
      </p>
      {status === 'success' ? (
        <div className="vzl-ks-success" role="status" aria-live="polite">
          <strong>You&rsquo;re on the list.</strong> We&rsquo;ll be in
          touch when the campaign launches.
        </div>
      ) : (
        <form className="vzl-ks-form" onSubmit={handleSubmit} noValidate>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="vzl-ks-input"
            disabled={status === 'submitting'}
            required
            aria-label="Email address"
          />
          <button
            type="submit"
            className="vzl-btn vzl-btn--primary"
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Joining…' : 'Join the list'}
          </button>
          {status === 'error' && <p className="vzl-ks-error">{error}</p>}
        </form>
      )}
    </section>
  );
}
