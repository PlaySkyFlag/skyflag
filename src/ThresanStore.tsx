// ThresanStore — the physical-edition waitlist landing, served at
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
import { supabase } from './game/supabase';
import './ThresanStore.css';

// ─── Configuration ─────────────────────────────────────────────────
// Fill these in as the campaign reaches each milestone. Empty strings
// are handled gracefully — the page degrades to email-only signup.

// Stripe Payment Link for the $108 refundable Founders Edition
// Reservation. Capped at 500 payments (Stripe enforces server-side).
// Empty string disables the Reserve button and degrades the page to
// email-only signup — useful if reservations need to be paused.
const FOUNDERS_RESERVATION_URL = 'https://buy.stripe.com/14A7sFdUCgpzg9R3PNbwk00';

// Paste the live Kickstarter campaign URL here once the campaign
// launches. Empty = pre-launch (current state).
const KICKSTARTER_URL = '';

const FOUNDERS_PRICE_USD = 108;
const FOUNDERS_TOTAL_SLOTS = 500;

const ORIGINS_URL = 'https://playskyflag.com/origins?ref=thresan-store';
const GAME_URL = 'https://playskyflag.com/play?ref=thresan-store';

// ─── Page ──────────────────────────────────────────────────────────

export default function ThresanStore() {
  useEffect(() => {
    window.scrollTo(0, 0);
    const prevTitle = document.title;
    document.title = 'Thresan™: Skyflag — The Physical Edition';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = desc?.content ?? null;
    if (desc) {
      desc.content =
        'The physical edition of Thresan: Skyflag — three boards, lifted. Coming to Kickstarter. Reserve your Founders Edition or join the waitlist.';
    }
    return () => {
      document.title = prevTitle;
      if (desc && prevDesc !== null) desc.content = prevDesc;
    };
  }, []);

  return (
    <div className="store">
      <Header />
      <main>
        <Hero />
        <Showcase />
        <Prototype />
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
          Sixty-four squares opened to one hundred and eight. Three
          stacked boards — transparent, illuminated, brass-piece-and-
          acrylic construction.{' '}
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
          src="/skyflag-render-tower.jpg"
          alt="Thresan: Skyflag physical edition — three transparent stacked boards on an illuminated base, brass and acrylic pieces."
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
      label: `Reserve a Founders Edition · $${FOUNDERS_PRICE_USD}`,
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
          <figure className="store-figure">
            <img
              src="/skyflag-render-tower.jpg"
              alt="Transparent terrace tower layout — three boards stacked vertically with a central column on a metallic base."
              className="store-figure-img"
              loading="lazy"
            />
            <figcaption className="store-figure-caption">
              Concept render — transparent terrace tower layout
            </figcaption>
          </figure>
          <figure className="store-figure">
            <img
              src="/skyflag-render-fan.jpg"
              alt="Fan-spread layout — three boards fanned out from a shared illuminated rear hub."
              className="store-figure-img"
              loading="lazy"
            />
            <figcaption className="store-figure-caption">
              Concept render — fan-spread array layout
            </figcaption>
          </figure>
        </div>
        <ul className="store-includes">
          <li>
            <strong>Three 6×6 boards</strong> — Terran, Meridian, Empyrean
          </li>
          <li>
            <strong>Four pieces per side</strong> — Captain, Soldier,
            Rover, Pilot — slate and ivory finishes
          </li>
          <li>
            <strong>Illuminated base</strong> with the Thresan sigil
          </li>
          <li>
            <strong>Bound rulebook</strong> — the Three Seals of Kaleo,
            illustrated
          </li>
          <li>
            <strong>Cloth carry bag</strong> for the pieces
          </li>
        </ul>
        <p className="store-section-fineprint">
          Renders shown are concept art for the manufactured premium
          edition — used to set context for what the physical edition
          aspires to. Actual photographs of the 3D-printed prototype
          coming soon. Final component spec confirmed at Kickstarter
          launch; reservations carry the same price into and through
          the campaign.
        </p>
      </div>
    </section>
  );
}

// ─── Prototype — the kitchen-counter beat ──────────────────────────
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
            alt="Hand-built three-layer prototype of Thresan: Skyflag on a kitchen counter — cardboard boards, wooden dowels at the corners, painted figurines as game pieces."
            className="store-prototype-img"
            loading="lazy"
          />
          <figcaption className="store-prototype-caption">
            The first prototype — kitchen, cardboard, dowels.
          </figcaption>
        </figure>
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
              #001 — #{String(FOUNDERS_TOTAL_SLOTS).padStart(3, '0')}
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
              Founders reservations opening soon —{' '}
              <a href="#waitlist">join the waitlist to be notified first.</a>
            </div>
          )}
        </div>
        <p className="store-founders-refund">
          Fully refundable any time before shipping. Your deposit
          applies in full to your Kickstarter pledge when the campaign
          launches — you're not paying extra.
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
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      });
    // 23505 = unique-violation. Treat duplicate signups as success
    // rather than surfacing "you're already on the list" — that would
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
        {status === 'success' ? (
          <div className="store-waitlist-success">
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
            a="Date TBA. The waitlist gets the launch email first — typically a heads-up two to four weeks ahead of the campaign and a final note the morning the campaign goes live."
          />
          <FaqItem
            q="What does the Founders deposit cover?"
            a={`A $${FOUNDERS_PRICE_USD} refundable deposit reserves one of the first ${FOUNDERS_TOTAL_SLOTS} numbered copies and earns the Founders perks above. When the Kickstarter launches, your deposit applies in full as a credit toward your pledge — you're not paying extra to reserve, and the deposit remains refundable any time before shipping.`}
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
                stays free. The physical edition is a tabletop instrument
                — three layers, brass and acrylic — playable by candlelight,
                kept on a shelf, gifted forward. Same game, different
                medium.
              </>
            }
          />
          <FaqItem
            q={`Why $${FOUNDERS_PRICE_USD}?`}
            a={
              <>
                Sixty-four squares become one hundred and eight. The
                price is the math.{' '}
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
          <a href={GAME_URL}>Play digital</a>
        </p>
        <p className="store-footer-meta">
          © {new Date().getFullYear()} Limnology Research Corp.
        </p>
      </div>
    </footer>
  );
}
