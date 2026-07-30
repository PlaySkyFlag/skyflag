// ThresanStore, the physical-edition waitlist landing, served at
// thresan.store. The Kickstarter handles every hard part of selling
// (payments, fulfillment, trust), so this surface only needs to do
// three things: build a pre-launch email list, capture high-intent
// Founders deposits via a Stripe Payment Link, and 301 traffic into
// the Kickstarter once the campaign is live.
//
// Currently in Stage 1: pre-launch waitlist. When Kickstarter goes
// live, flip the KICKSTARTER_URL constant and the page swaps its
// primary CTA to "Back us on Kickstarter →" without further code.

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { applySurfaceMeta } from './socialMeta';
import { supabase } from './game/supabase';
import './ThresanStore.css';
import ConsentCheckbox from './ConsentCheckbox';
import { KICKSTARTER_PRELAUNCH_URL } from './kickstarterLink';
import { getUtmSource } from './utmSource';
import { currentPhase, KICKSTARTER_LIVE_URL } from './campaign';

// ─── Configuration ─────────────────────────────────────────────────
// Fill these in as the campaign reaches each milestone. Empty strings
// are handled gracefully, the page degrades to email-only signup.

// Stripe Payment Link for the $108 refundable Founders Edition
// Reservation. Capped at 500 payments (Stripe enforces server-side).
// Empty string disables the Reserve button and degrades the page to
// email-only signup, useful if reservations need to be paused.
const FOUNDERS_RESERVATION_URL = 'https://buy.stripe.com/14A7sFdUCgpzg9R3PNbwk00';

// Live-campaign URL, now derived from the shared campaign module rather
// than a constant someone has to remember to flip on launch morning. It
// resolves to '' until the phase is LIVE and a live URL is known, so the
// existing `KICKSTARTER_URL ? … : …` checks below keep their meaning.
const KICKSTARTER_URL =
  currentPhase() === 'LIVE' ? KICKSTARTER_LIVE_URL : '';

// Kickstarter pre-launch page URL ("Notify me on launch") — now the live
// link, sourced from the shared kickstarterLink module so every surface
// stays in sync. Followers gathered here convert to backers at roughly
// twice the rate of people who discover the campaign after it's live, so
// this is the highest-value pre-launch funnel after the email list.

const FOUNDERS_PRICE_USD = 108;
const FOUNDERS_TOTAL_SLOTS = 500;

const ORIGINS_URL = 'https://playskyflag.com/origins?ref=thresan-store';
const GAME_URL = 'https://playskyflag.com/play?ref=thresan-store';

// ─── Reward tier preview ───────────────────────────────────────────
// Preliminary Kickstarter reward ladder. Prices, slot counts, and
// inclusions are placeholders, they'll be re-tuned once manufacturer
// quotes come back and the funding goal is locked. The Founders
// Edition tier is the only one currently with a live pre-launch
// reservation (FOUNDERS_RESERVATION_URL above). Each tier inherits
// everything in the tier below it (additive structure).

type RewardTier = {
  id: string;
  name: string;
  priceUSD: number;
  // Overrides the displayed price (e.g. 'TBD') while priceUSD still
  // drives the live deposit amount. Manufacturing quotes aren't locked,
  // so the Founders final price shows TBD even though the $108 deposit
  // is live.
  priceDisplay?: string;
  pitch: string;
  includes: string[];
  live?: boolean;
  limited?: boolean;
  reserveHref?: string;
};

// The four Kickstarter reward tiers, mirrored from the live campaign.
// Prices show TBD until manufacturing quotes return and the funding
// goal is locked. The $108 pre-launch deposit lives in the Founders()
// section + hero CTA below (kept live for now), not in this ladder.
const REWARD_TIERS: RewardTier[] = [
  {
    id: 'day-one',
    name: 'Day-One Supporter',
    priceUSD: 1,
    priceDisplay: 'TBD',
    pitch: 'Be first in line.',
    includes: [
      'Day-One Club membership: a launch-day notification the moment the campaign goes live',
      'Early-bird access to the best launch pricing',
      'Backer-only build updates from inside the studio',
    ],
  },
  {
    id: 'maker-files',
    name: 'Maker Files (Print-It-Yourself)',
    priceUSD: 20,
    priceDisplay: 'TBD',
    pitch: 'Make it yourself.',
    includes: [
      'The complete digital build files to print and assemble your own Thresan: Skyflag set',
      'The full Thresan: Skyflag rulebook (PDF)',
    ],
  },
  {
    id: 'standard',
    name: 'Standard Edition',
    priceUSD: 75,
    priceDisplay: 'TBD',
    pitch: 'The full physical game.',
    includes: [
      'One copy of Thresan: Skyflag, the complete physical game',
      'Three stacked boards, four Lifts, the full piece set, and the rulebook',
    ],
  },
  {
    id: 'collector',
    name: 'Premium / Collector Edition',
    priceUSD: FOUNDERS_PRICE_USD,
    priceDisplay: 'TBD',
    pitch: 'The collector’s object.',
    includes: [
      'One copy of Thresan: Skyflag in premium, collector form',
      'Premium components and upgraded board construction',
      'Foil rulebook cover and collector packaging',
      'Your name in the rulebook acknowledgments',
    ],
  },
];

// ─── Page ──────────────────────────────────────────────────────────

export default function ThresanStore() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'Thresan™: Skyflag, The Physical Edition',
      description:
        'The physical edition of Thresan: Skyflag, three boards, lifted. Coming to Kickstarter. Reserve your Founders Edition or join the waitlist.',
      canonicalUrl: 'https://thresan.store/',
      ogImage: 'https://thresan.store/thresan-og-nexus.jpg',
      ogImageAlt: 'The Caelum Nexus column glowing through three stacked boards, Thresan: Skyflag physical edition.',
    });
  }, []);

  return (
    <div className="store">
      <Header />
      <main>
        <Hero />
        <Showcase />
        <GameplayVideo />
        <Prototype />
        <Tiers />
        <Founders />
        <Waitlist />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="store-header">
      <div className="store-header-inner">
        <a href="https://playskyflag.com" className="store-back">
          ← Thresan™: Skyflag
        </a>
        <div className="store-header-meta">The Physical Edition</div>
        <a href={GAME_URL} className="store-cta-button store-cta-small">
          Play digital
        </a>
      </div>
    </header>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────

function Hero() {
  const primaryCta = primaryHeroCta();
  return (
    <section className="store-hero">
      <div className="store-hero-inner">
        <p className="store-hero-eyebrow">
          Thresan™: Skyflag · The Physical Edition
        </p>
        <h1 className="store-hero-title">
          Three worlds.
          <br />
          One table.
        </h1>
        <p className="store-hero-lead">
          Sixty-four squares opened to one hundred and eight. A premium
          three-tier object: stacked boards, integrated Lifts, premium
          pieces.{' '}
          {KICKSTARTER_URL ? (
            <strong>Live on Kickstarter.</strong>
          ) : (
            <strong>Coming to Kickstarter.</strong>
          )}
        </p>
        <div className="store-hero-actions">
          <a
            href={primaryCta.href}
            className="store-cta-button store-cta-primary store-cta-large"
          >
            {primaryCta.label}
          </a>
          {primaryCta.secondaryHref && (
            <a href={primaryCta.secondaryHref} className="store-cta-link">
              {primaryCta.secondaryLabel}
            </a>
          )}
        </div>
        <img
          src="/thresan-hero-nexus.jpg"
          alt="Thresan: Skyflag, three stacked boards with figurines arrayed across all three planes, gold Nexus column rising through the center."
          className="store-hero-render"
        />
      </div>
    </section>
  );
}

// CTA logic in one place. Three phases:
//   1. Pre-launch, no Founders link  → email waitlist is the CTA
//   2. Pre-launch, Founders link set  → Reserve is primary, waitlist secondary
//   3. Kickstarter live                → Back on KS is primary, waitlist gone
function primaryHeroCta(): {
  href: string;
  label: string;
  secondaryHref?: string;
  secondaryLabel?: string;
} {
  if (KICKSTARTER_URL) {
    return {
      href: KICKSTARTER_URL,
      label: 'Back us on Kickstarter →',
    };
  }
  if (FOUNDERS_RESERVATION_URL) {
    return {
      href: FOUNDERS_RESERVATION_URL,
      label: `Reserve a Founders Edition · $${FOUNDERS_PRICE_USD} deposit`,
      secondaryHref: '#waitlist',
      secondaryLabel: 'Just want updates? Join the free waitlist →',
    };
  }
  return {
    href: '#waitlist',
    label: 'Join the waitlist',
  };
}

// ─── Showcase ──────────────────────────────────────────────────────

function Showcase() {
  return (
    <section className="store-section store-section-alt">
      <div className="store-section-inner">
        <h2 className="store-section-title">What's in the box</h2>
        <div className="store-showcase">
          <figure className="store-figure store-figure-solo">
            <img
              src="/thresan-deluxe-board.jpg"
              alt="Concept render of Thresan: Skyflag, three stacked 6×6 boards (green Ground, cyan Sky, blue Space) fanned from a shared central hub."
              className="store-figure-img"
              loading="lazy"
            />
            <figcaption className="store-figure-caption">
              Concept render, center-balanced fan-spread, shared central
              hub
            </figcaption>
          </figure>
        </div>
        <ul className="store-includes">
          <li>
            <strong>Three 6×6 boards</strong>, Terran, Meridian, Empyrean
          </li>
          <li>
            <strong>Five playing pieces per side</strong>, Captain, Soldier,
            Promoted Soldier Captain, Rover, Pilot, slate and ivory
            finishes (ten pieces total in the box)
          </li>
          <li>
            <strong>Display base</strong> with the Thresan sigil
          </li>
          <li>
            <strong>Bound rulebook</strong>, the Three Seals of Kaleo,
            illustrated
          </li>
          <li>
            <strong>Cloth carry bag</strong> for the pieces
          </li>
        </ul>
        <p className="store-section-fineprint">
          The render shown is concept art for the manufactured premium
          edition, used to set context for what the physical edition
          aspires to. Actual photographs of the 3D-printed prototype
          coming soon. Final component spec confirmed at Kickstarter
          launch; reservations carry the same price into and through
          the campaign.
        </p>
      </div>
    </section>
  );
}

// ─── Gameplay video ────────────────────────────────────────────────
// Short silent gameplay loop. Sits right after the board showcase so a
// visitor sees the product, then sees it in motion, before the ask.

function GameplayVideo() {
  return (
    <section className="store-section store-video-section">
      <div className="store-section-inner">
        <h2 className="store-section-title">See it in play</h2>
        <div className="store-video">
          <video
            className="store-video-el"
            src="/thresan-gameplay.mp4"
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            Your browser doesn't support inline video.{' '}
            <a href="/thresan-gameplay.mp4" download>
              Download the clip
            </a>{' '}
            instead.
          </video>
        </div>
        <p className="store-video-caption">
          This is Thresan in play, three stacked boards (Ground, Sky,
          and Space), four pieces a side moving across all three planes
          at once, lifting between worlds to set up captures no flat
          board could hold. The digital game is{' '}
          <strong>free to play, always</strong>, at{' '}
          <a href="https://thresan.com">thresan.com</a>. The premium
          physical edition launches on <strong>Kickstarter on October 27, 2026</strong>.{' '}
          <a href="#waitlist">Sign up now</a> to get the launch email.
        </p>
        <div className="store-video-cta">
          <a href={GAME_URL} className="store-cta-button store-cta-ghost">
            Play the full game free →
          </a>
          <p className="store-video-cta-note">
            No signup, no paywall, try the whole game before you back.{' '}
            <a href="https://thresan.com/world" className="store-cta-link">
              Explore the world of Kaleo →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Prototype, the kitchen-counter beat ──────────────────────────
// Placed between the polished renders (Showcase) and the Founders ask.
// The job: prove the maker is real, the design is hand-tested, the
// product isn't vaporware. Photographic evidence right before the
// $108 commitment is the highest-leverage placement for trust.

function Prototype() {
  return (
    <section className="store-section">
      <div className="store-section-inner">
        <h2 className="store-section-title">Before the renders</h2>
        <p className="store-prototype-lead">
          The first version of Thresan: Skyflag lived on a kitchen
          counter. Three layers cut from board stock, dowels at the
          corners, painted figurines for pieces. The whole game's
          shape was tested here before any of it was rendered.
        </p>
        <figure className="store-prototype-figure">
          <img
            src="/thresan-prototype-kitchen.jpg"
            alt="Hand-built three-layer prototype of Thresan: Skyflag on a kitchen counter, cardboard boards, wooden dowels at the corners, painted figurines as game pieces."
            className="store-prototype-img"
            loading="lazy"
          />
          <figcaption className="store-prototype-caption">
            The first prototype, kitchen, cardboard, dowels.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

// ─── Reward tiers (preview) ────────────────────────────────────────

function Tiers() {
  return (
    <section id="tiers" className="store-section store-section-alt">
      <div className="store-section-inner">
        <p className="store-section-eyebrow">Preview</p>
        <h2 className="store-section-title">Reward tiers</h2>
        <p className="store-founders-lead">
          A preview of the four Kickstarter reward tiers. Prices show{' '}
          <em>TBD</em> until manufacturing quotes return and the
          funding goal is set; the tiers preview here so backers know
          what's coming. A refundable pre-launch deposit (below) lets
          you reserve early.
        </p>

        <div className="store-tier-grid">
          {REWARD_TIERS.map((tier) => (
            <article
              key={tier.id}
              className={`store-tier${tier.live ? ' store-tier--live' : ''}`}
            >
              <div className="store-tier-flags">
                {tier.live && <span className="store-tier-flag store-tier-flag--live">Live now</span>}
                {tier.limited && (
                  <span className="store-tier-flag store-tier-flag--limited">Limited</span>
                )}
              </div>
              <h3 className="store-tier-name">{tier.name}</h3>
              <p className="store-tier-price">
                {tier.priceDisplay ? (
                  tier.priceDisplay
                ) : (
                  <>
                    ${tier.priceUSD}
                    <span className="store-tier-price-unit"> USD</span>
                  </>
                )}
              </p>
              <p className="store-tier-pitch">{tier.pitch}</p>
              <ul className="store-tier-includes">
                {tier.includes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              {tier.live && tier.reserveHref && (
                <a
                  href={tier.reserveHref}
                  className="store-cta-button store-cta-primary store-tier-cta"
                >
                  Reserve · ${tier.priceUSD} refundable deposit
                </a>
              )}
            </article>
          ))}
        </div>

        <p className="store-section-fineprint">
          <strong>Subject to change.</strong> Manufacturing quotes are
          still in progress, final prices, slot counts, and
          inclusions will be re-tuned before the campaign launches.{' '}
          <strong>Shipping</strong> is not included in physical tiers
          and is expected at <em>$20–40 USD</em> depending on region
          (locked at pledge management after the campaign closes).
        </p>
      </div>
    </section>
  );
}

// ─── Founders Edition ──────────────────────────────────────────────

function Founders() {
  return (
    <section id="founders" className="store-section">
      <div className="store-section-inner">
        <h2 className="store-section-title">The Founders Edition</h2>
        <p className="store-founders-lead">
          The first {FOUNDERS_TOTAL_SLOTS} copies of the physical
          edition, reserved in advance. Your deposit holds the slot,
          locks in the Kickstarter price, and applies in full to your
          pledge when the campaign launches.
        </p>
        <ul className="store-founders-perks">
          <li>
            <strong>Numbered First Edition</strong>{' '}
            <span className="store-founders-perk-detail">
              #001, #{String(FOUNDERS_TOTAL_SLOTS).padStart(3, '0')}
            </span>
          </li>
          <li>
            <strong>Locked-in Kickstarter pledge price</strong>{' '}
            <span className="store-founders-perk-detail">
              immune to mid-campaign increases
            </span>
          </li>
          <li>
            <strong>Name in the rulebook acknowledgments</strong>
          </li>
          <li>
            <strong>Founders Discord</strong>{' '}
            <span className="store-founders-perk-detail">
              early playtests, build updates, decision input
            </span>
          </li>
          <li>
            <strong>Lifetime Plus access</strong> to the digital game
          </li>
        </ul>
        <div className="store-founders-action">
          {FOUNDERS_RESERVATION_URL ? (
            <a
              href={FOUNDERS_RESERVATION_URL}
              className="store-cta-button store-cta-primary store-cta-large"
            >
              Reserve · ${FOUNDERS_PRICE_USD} refundable deposit
            </a>
          ) : (
            <div className="store-founders-soon">
              Founders reservations opening soon, {' '}
              <a href="#waitlist">join the waitlist to be notified first.</a>
            </div>
          )}
        </div>
        <p className="store-founders-refund">
          Fully refundable any time before shipping. Your deposit
          applies in full to your Kickstarter pledge when the campaign
          launches, you're not paying extra.
        </p>
      </div>
    </section>
  );
}

// ─── Waitlist form ─────────────────────────────────────────────────

function Waitlist() {
  const [email, setEmail] = useState('');
  const [status, setStatus] =
    useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [consent, setConsent] = useState(false);

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
      setError("Couldn't reach the waitlist right now. Please try again later.");
      return;
    }
    setStatus('submitting');
    setError('');
    const { error: insertError } = await supabase
      .from('thresan_waitlist')
      .insert({
        email: trimmed,
        source: 'thresan-store',
        utm_source: getUtmSource(),
        consent: true,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      });
    // 23505 = unique-violation. Treat duplicate signups as success
    // rather than surfacing "you're already on the list", that would
    // leak signup status of any email an attacker tries.
    if (insertError && insertError.code !== '23505') {
      setStatus('error');
      setError("Couldn't save your email. Please try again.");
      return;
    }
    setStatus('success');
  };

  return (
    <section id="waitlist" className="store-section store-section-alt">
      <div className="store-section-inner store-waitlist-inner">
        <h2 className="store-section-title">Get the launch email</h2>
        <p className="store-waitlist-lead">
          One email when the Kickstarter goes live. That's the only
          thing the list is for.
        </p>
        {KICKSTARTER_PRELAUNCH_URL && !KICKSTARTER_URL && (
          <p className="store-waitlist-alt">
            Prefer Kickstarter?{' '}
            <a
              href={KICKSTARTER_PRELAUNCH_URL}
              target="_blank"
              rel="noreferrer"
            >
              Follow the pre-launch page →
            </a>{' '}
            and Kickstarter notifies you the moment we go live.
          </p>
        )}
        {status === 'success' ? (
          <div
            className="store-waitlist-success"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <strong>You're on the list.</strong> We'll be in touch when
            the campaign launches.
          </div>
        ) : (
          <form
            className="store-waitlist-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="store-waitlist-input"
              disabled={status === 'submitting'}
              required
              aria-label="Email address"
            />
            <ConsentCheckbox
              checked={consent}
              onChange={setConsent}
              disabled={status === 'submitting'}
            />
            <button
              type="submit"
              className="store-cta-button store-cta-primary"
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? 'Joining…' : 'Join waitlist'}
            </button>
            {status === 'error' && (
              <p className="store-waitlist-error">{error}</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

// ─── FAQ ───────────────────────────────────────────────────────────

function Faq() {
  return (
    <section className="store-section">
      <div className="store-section-inner">
        <h2 className="store-section-title">Questions</h2>
        <div className="store-faq">
          <FaqItem
            q="When does the Kickstarter launch?"
            a="The campaign launches October 27, 2026. The waitlist gets a heads-up two to four weeks ahead and a final reminder the morning it goes live."
          />
          <FaqItem
            q="What does the Founders deposit cover?"
            a={`A $${FOUNDERS_PRICE_USD} refundable deposit reserves one of the first ${FOUNDERS_TOTAL_SLOTS} numbered copies and earns the Founders perks above. When the Kickstarter launches, your deposit applies in full as a credit toward your pledge, you're not paying extra to reserve, and the deposit remains refundable any time before shipping.`}
          />
          <FaqItem
            q="Refunds?"
            a="Fully refundable any time before the units ship. Email and the refund goes back to your card. No questions, no friction."
          />
          <FaqItem
            q="How is this different from the digital game?"
            a={
              <>
                The digital game is free at{' '}
                <a href="https://playskyflag.com">playskyflag.com</a> and
                stays free. The physical edition is a tabletop instrument,
                three layers you can hold, set up on the table, kept on a
                shelf, gifted forward. Same game, different medium.
              </>
            }
          />
          <FaqItem
            q={`Why a $${FOUNDERS_PRICE_USD} deposit?`}
            a={
              <>
                Sixty-four squares become one hundred and eight, the
                deposit is the math, not the final price. The edition
                price is set with the campaign; your deposit applies to
                it in full.{' '}
                <a href={ORIGINS_URL}>Read more in Origins →</a>
              </>
            }
          />
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
  return (
    <div className="store-faq-item">
      <h3 className="store-faq-q">{q}</h3>
      <div className="store-faq-a">{a}</div>
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="store-footer">
      <div className="store-footer-inner">
        <p className="store-footer-mark">Thresan™: Skyflag</p>
        <p className="store-footer-tagline tagline-script">
          Three worlds. One proof.
        </p>
        <p className="store-footer-links">
          <a href="https://playskyflag.com">Home</a> ·{' '}
          <a href={ORIGINS_URL}>Origins</a> ·{' '}
          <a href={GAME_URL}>Play digital</a> ·{' '}
          <a href="https://playskyflag.com/privacy">Privacy</a> ·{' '}
          <a href="https://playskyflag.com/terms">Terms</a> ·{' '}
          <a href="https://playskyflag.com/ai-use">AI use</a>
        </p>
        <p className="store-footer-meta">
          © {new Date().getFullYear()} Limnology Research Corp.
        </p>
      </div>
    </footer>
  );
}
