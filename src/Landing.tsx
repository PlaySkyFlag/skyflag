// playskyflag.com landing page. Marketing surface for new visitors —
// what SkyFlag is, why to play, where to start. The game itself lives
// at /play; this page links there.
//
// Design notes:
//   - Visual palette mirrors the in-game gold-on-dark aesthetic so the
//     handoff from landing → game feels continuous.
//   - One-page scroll layout (hero → features → demo → pricing → footer);
//     no separate pages until there's content to justify them.
//   - All copy is intentionally concise. Indie-game landing pages over-
//     promise with marketing speak; we're better off being direct about
//     what exists today.

import { useEffect } from 'react';
import './Landing.css';

export default function Landing() {
  // Nudge the browser to scroll to the top whenever the landing
  // mounts. Helps the case where the user came back from /play and
  // their browser remembered a deep scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="landing">
      <Header />
      <Hero />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <a href="/" className="landing-logo">SkyFlag</a>
        <nav className="landing-nav">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#pricing" className="landing-nav-link">Pricing</a>
          <a href="/play" className="landing-cta-button landing-cta-small">Play</a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero-inner">
        <h1 className="landing-hero-title">SkyFlag</h1>
        <p className="landing-hero-subtitle">
          Strategy across three skies. Capture the flags or seize the Nexus.
        </p>
        <p className="landing-hero-pitch">
          A turn-based strategy game played simultaneously on three boards —
          ground, sky, and space. Four piece types, two paths to victory,
          and an AI that's been tuned to think like a chess engine.
        </p>
        <div className="landing-hero-actions">
          <a href="/play" className="landing-cta-button landing-cta-primary">
            ▶ Play free
          </a>
          <a href="#how-it-works" className="landing-cta-button landing-cta-secondary">
            How it works
          </a>
        </div>
        <p className="landing-hero-fineprint">
          No account required. Solo vs AI, hot-seat 2P, and online play
          all work in the browser.
        </p>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-section-inner">
        <h2 className="landing-section-title">What makes SkyFlag different</h2>
        <div className="landing-features-grid">
          <Feature
            icon="◇◆◇"
            title="Three boards at once"
            body="Every game plays out simultaneously across Ground, Sky, and Space. Lifts move pieces between layers — but cost two activations, so vertical momentum has to be earned."
          />
          <Feature
            icon="♚♟♜♝"
            title="Four pieces, distinct roles"
            body="Captains capture flags. Soldiers advance and promote. Rovers and Pilots transport between layers and leap-capture in close quarters. No piece is interchangeable."
          />
          <Feature
            icon="∞"
            title="Two ways to win"
            body="Capture all three of your opponent's flags — or seize the Nexus on the Space layer once the flags are gone. Both paths reward different play styles."
          />
          <Feature
            icon="✦"
            title="A real AI"
            body="Iterative-deepening minimax with alpha-beta pruning, transposition tables, quiescence search, killer-move heuristic, piece-square tables, and a tuned opening book. Hard mode is genuinely hard."
          />
          <Feature
            icon="◷"
            title="Time controls + daily puzzle"
            body="Play untimed, blitz, or rapid. A new puzzle every 24 hours — same position for everyone, one attempt to find the best move."
          />
          <Feature
            icon="♛"
            title="Online play with ratings"
            body="Sign in (or stay as guest), invite a friend by code or link, play asynchronously with push notifications. ELO-tracked. Free."
          />
        </div>
      </div>
    </section>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="landing-feature">
      <div className="landing-feature-icon">{icon}</div>
      <h3 className="landing-feature-title">{title}</h3>
      <p className="landing-feature-body">{body}</p>
    </div>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="landing-section landing-section-alt">
      <div className="landing-section-inner">
        <h2 className="landing-section-title">How a game flows</h2>
        <ol className="landing-howto-list">
          <li>
            <strong>Deploy.</strong> Each player starts with four pieces in
            hand and one fixed deploy square on Ground. Get them onto the
            board, one activation at a time.
          </li>
          <li>
            <strong>Advance.</strong> Push your Soldier and Captain toward
            the opponent's flag corners. Use Rovers and Pilots to lift
            pieces between layers when the path opens up.
          </li>
          <li>
            <strong>Trade and pressure.</strong> Two activations per turn
            means tempo matters. Threats compound across layers — a piece
            that's safe on Ground may be one lift away from a Sky capture.
          </li>
          <li>
            <strong>Win.</strong> Capture all three opponent flags (Captain
            lands on the flag square), or seize the Nexus at Space(3,3) once
            all flags are off the board.
          </li>
        </ol>
        <div className="landing-howto-cta">
          <a href="/play" className="landing-cta-button landing-cta-primary">
            ▶ Try a game
          </a>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="landing-section">
      <div className="landing-section-inner">
        <h2 className="landing-section-title">Pricing</h2>
        <p className="landing-pricing-lead">
          The full game is free. Plus is for players who want the extra mile.
        </p>
        <div className="landing-pricing-grid">
          <div className="landing-pricing-tier">
            <div className="landing-tier-name">Free</div>
            <div className="landing-tier-price">
              <span className="landing-tier-price-num">$0</span>
              <span className="landing-tier-price-period">forever</span>
            </div>
            <ul className="landing-tier-features">
              <li>Full game, all difficulty levels</li>
              <li>Online play with ratings</li>
              <li>Friends + tournaments</li>
              <li>Daily puzzle</li>
              <li>Time controls</li>
            </ul>
            <a href="/play" className="landing-tier-cta landing-cta-secondary">
              Start playing
            </a>
          </div>
          <div className="landing-pricing-tier landing-pricing-featured">
            <div className="landing-tier-badge">Plus</div>
            <div className="landing-tier-name">SkyFlag Plus</div>
            <div className="landing-tier-price">
              <span className="landing-tier-price-num">$4.99</span>
              <span className="landing-tier-price-period">/ month</span>
            </div>
            <ul className="landing-tier-features">
              <li>Everything in Free</li>
              <li>Advanced AI difficulty (deeper search)</li>
              <li>Puzzle archive with analysis</li>
              <li>Custom themes</li>
              <li>Ad-free</li>
              <li>Support active development</li>
            </ul>
            <a href="/play" className="landing-tier-cta landing-cta-primary">
              Start with free, upgrade later
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <strong>SkyFlag</strong>
          <p>By Limnology Research Corp.</p>
        </div>
        <div className="landing-footer-links">
          <a href="/play">Play</a>
          <a href="#pricing">Pricing</a>
          <a href="https://github.com/PlaySkyFlag/skyflag" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
        <div className="landing-footer-meta">
          © {new Date().getFullYear()} Limnology Research Corp.
        </div>
      </div>
    </footer>
  );
}
