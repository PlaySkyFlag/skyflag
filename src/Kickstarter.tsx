// Kickstarter, the focused launch-capture page served at /kickstarter on
// every host, canonical on thresan.com. The single destination all surfaces
// funnel toward: one ask (the email), segmentation checkboxes so the list is
// useful later, and a required CASL/GDPR consent box. Signups write to the
// same thresan_waitlist table tagged source 'thresan-kickstarter', so the
// pg_net → Kit trigger auto-syncs them into the newsletter list.
//
// Deliberately one screen + a short pitch: no nav, no competing links, the
// deluxe-board render doing the heavy lifting. Lead magnet is the real free
// prequel (Volume Zero, The Eight-Footed Mark), not a vaporware title.

import { useEffect, useState, type FormEvent } from 'react';
import './Kickstarter.css';
import { applySurfaceMeta } from './socialMeta';
import { supabase } from './game/supabase';

const READER_URL = 'https://thresan.studio/volume-zero';
const WORLD_URL = 'https://thresan.com/world';
const STORE_URL = 'https://thresan.store';

const INTERESTS = [
  { id: 'backing', label: 'Backing the Kickstarter' },
  { id: 'updates', label: 'Game updates & the world of Kaleo' },
  { id: 'novel', label: 'The Thresan graphic novel' },
];

export default function Kickstarter() {
  const [email, setEmail] = useState('');
  const [interests, setInterests] = useState<string[]>(['backing']);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] =
    useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'Thresan: Skyflag, coming to Kickstarter',
      description:
        'A premium three-layer strategy game: three stacked boards, four Lifts, one Nexus. Be first to know when Thresan: Skyflag launches on Kickstarter in Fall 2026, and claim early-backer pricing.',
      canonicalUrl: 'https://thresan.com/kickstarter',
      ogImage: 'https://thresan.com/thresan-deluxe-board.jpg',
      ogImageAlt:
        'Concept render of Thresan: Skyflag, three stacked boards fanned from a shared central hub.',
    });
  }, []);

  const toggleInterest = (id: string) =>
    setInterests((cur) =>
      cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id],
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setStatus('error');
      setError('Please enter a valid email.');
      return;
    }
    if (!consent) {
      setStatus('error');
      setError('Please tick the consent box so we can email you.');
      return;
    }
    if (!supabase) {
      setStatus('error');
      setError("Couldn't reach the list right now. Please try again later.");
      return;
    }
    setStatus('submitting');
    setError('');
    // Capture the social platform from the UTM link so signups attribute by
    // source in the CRM. Keep `source` = 'thresan-kickstarter' (the Kit
    // tag-sync keys off it); the platform rides in its own column.
    const utm = new URLSearchParams(window.location.search)
      .get('utm_source');
    const utmSource = utm
      ? utm.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40)
      : null;
    const { error: insertError } = await supabase
      .from('thresan_waitlist')
      .insert({
        email: trimmed,
        source: 'thresan-kickstarter',
        utm_source: utmSource,
        interests,
        consent: true,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      });
    // 23505 = duplicate; treat as success so the form can't probe the list.
    if (insertError && insertError.code !== '23505') {
      setStatus('error');
      setError("Couldn't save your email. Please try again.");
      return;
    }
    setStatus('success');
  };

  return (
    <div className="ks">
      <main className="ks-inner">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <header className="ks-hero">
          <p className="ks-eyebrow">Coming to Kickstarter · Fall 2026</p>
          <h1 className="ks-headline">
            Three layers. One Nexus.
            <br />
            <span className="ks-headline-accent">
              Strategy in three dimensions.
            </span>
          </h1>
          <p className="ks-subhead">
            Thresan is a premium three-layer strategy game: three stacked
            boards, four Lifts, one shared hub. Be first to know when it
            launches, and claim early-backer pricing.
          </p>
          <img
            src="/thresan-deluxe-board.jpg"
            alt="Concept render of Thresan: Skyflag, three stacked 6×6 boards fanned from a shared central hub."
            className="ks-hero-art"
          />
          <a href="#notify" className="ks-hero-cta">
            Notify me at launch ↓
          </a>
        </header>

        {/* ── Pitch ────────────────────────────────────────────── */}
        <section className="ks-pitch">
          <p>
            Thresan is a two-player contest of pure geometry across three
            stacked boards. Two ways to win: capture your opponent's
            Captain and Soldier, the way chess ends a game, or send your
            own Captain to seize all three of their flags and land on the
            Nexus at the summit.{' '}
            <strong>No dice, no cards, no luck.</strong> The Skyflag
            edition is a premium, three-tier object built to live on the
            table: stackable boards, integrated Lifts, and a numbered
            collector edition.
          </p>
        </section>

        {/* ── Capture ──────────────────────────────────────────── */}
        <section id="notify" className="ks-capture">
          {status === 'success' ? (
            <div className="ks-success" role="status" aria-live="polite">
              <h2 className="ks-success-title">You're first in line.</h2>
              <p>
                We'll email you the moment the Kickstarter goes live, plus
                the early-backer offer. While you wait, read the free
                prequel:
              </p>
              <div className="ks-success-actions">
                <a href={READER_URL} className="ks-btn">
                  Read Volume Zero free →
                </a>
                <a href={WORLD_URL} className="ks-link">
                  Explore the world of Kaleo →
                </a>
              </div>
            </div>
          ) : (
            <>
              <h2 className="ks-capture-title">Be first to know</h2>
              <form className="ks-form" onSubmit={handleSubmit} noValidate>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="ks-input"
                  disabled={status === 'submitting'}
                  required
                  aria-label="Email address"
                />

                <fieldset className="ks-interests">
                  <legend>What are you most interested in? (pick any)</legend>
                  {INTERESTS.map((it) => (
                    <label key={it.id} className="ks-check">
                      <input
                        type="checkbox"
                        checked={interests.includes(it.id)}
                        onChange={() => toggleInterest(it.id)}
                      />
                      <span>{it.label}</span>
                    </label>
                  ))}
                </fieldset>

                <label
                  className={`ks-check ks-consent${
                    status === 'error' && !consent ? ' ks-consent-error' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  <span>
                    <strong className="ks-consent-flag">Required</strong>
                    Yes, email me about Thresan, the Kickstarter launch, and
                    related updates from Limnology Research Corp. Tick this box
                    to subscribe. I can unsubscribe anytime.
                  </span>
                </label>

                <button
                  type="submit"
                  className="ks-btn ks-btn-submit"
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'Joining…' : 'Count me in'}
                </button>
                {status === 'error' && (
                  <p className="ks-error">{error}</p>
                )}
                <p className="ks-microcopy">
                  Early backers get the best price and a limited launch-day
                  reward. No spam, unsubscribe anytime.
                </p>
              </form>
            </>
          )}
        </section>

        {/* ── Lead magnet ──────────────────────────────────────── */}
        <section className="ks-magnet">
          <h2 className="ks-magnet-title">Start reading free</h2>
          <p>
            Sign up and dive into <strong>Volume Zero, The Eight-Footed
            Mark</strong>, the graphic prequel to Thresan: Skyflag. Free to
            read right now, with the world of Kaleo waiting behind it.
          </p>
          <a href={READER_URL} className="ks-link">
            Read the free prequel →
          </a>
        </section>

        {/* ── Footer strip ─────────────────────────────────────── */}
        <p className="ks-footer">
          Three layers. Four Lifts. One Nexus. Ages 14+. Thresan™: Skyflag,
          from the studio of Dr. Nelson Jatel, a project of Limnology
          Research Corp.{' '}
          <a href={STORE_URL}>The physical edition →</a>
        </p>
      </main>
    </div>
  );
}
