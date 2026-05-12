// Landing page. Marketing surface for new visitors —
// what Skyflag is, why to play, where to start. The game itself lives
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

import { useEffect, useState } from 'react';
import Board, { type Marker } from './Board';
import {
  FLAG_COORDS,
  LIFT_CELLS,
  LAYER_ORDER,
  NEXUS_COORD,
} from './game/constants';
import { THEMES, type ThemeId } from './game/themes';
import type { Layer, PieceKind, Player } from './game/types';
import './Landing.css';

// Mid-game snapshot rendered in the demo section. Hand-curated for
// visual balance: both sides have committed soldiers + captains on
// Ground, transports have lifted to Sky, the position has tension.
// Static — no clicks, no animation.
type DemoPiece = {
  owner: Player;
  kind: PieceKind;
  layer: Layer;
  row: number;
  col: number;
  id: string;
};

const DEMO_PIECES: ReadonlyArray<DemoPiece> = [
  // Ground — both sides advancing toward the opponent's flag corner
  { owner: 'p1', kind: 'soldier', layer: 'ground', row: 2, col: 3, id: 'demo-p1-soldier' },
  { owner: 'p1', kind: 'captain', layer: 'ground', row: 3, col: 4, id: 'demo-p1-captain' },
  { owner: 'p2', kind: 'captain', layer: 'ground', row: 3, col: 1, id: 'demo-p2-captain' },
  { owner: 'p2', kind: 'soldier', layer: 'ground', row: 4, col: 2, id: 'demo-p2-soldier' },
  // Sky — Pilots / Rovers lifted up to support layer transitions
  { owner: 'p1', kind: 'pilot',   layer: 'sky', row: 1, col: 4, id: 'demo-p1-pilot'  },
  { owner: 'p2', kind: 'rover',   layer: 'sky', row: 4, col: 1, id: 'demo-p2-rover'  },
  // Space — empty in this snapshot; pieces haven't reached the upper layer yet
];

const PIECE_SYMBOL: Record<PieceKind, string> = {
  captain: '♚',
  soldier: '♟',
  rover: '♜',
  pilot: '♝',
};

function demoMarkers(layer: Layer): Marker[] {
  const markers: Marker[] = [];
  // Lifts on every layer
  for (const cell of LIFT_CELLS) {
    markers.push({ row: cell.row, col: cell.col, symbol: '⬆', kind: 'lift' });
  }
  // Both flags shown (none captured in the demo)
  for (const player of ['p1', 'p2'] as Player[]) {
    const pos = FLAG_COORDS[player][layer];
    markers.push({ row: pos.row, col: pos.col, symbol: '⚑', kind: player });
  }
  // Nexus on Space
  if (layer === 'space') {
    markers.push({
      row: NEXUS_COORD.row,
      col: NEXUS_COORD.col,
      symbol: '◎',
      kind: 'nexus',
    });
  }
  // Pieces
  for (const p of DEMO_PIECES) {
    if (p.layer !== layer) continue;
    markers.push({
      row: p.row,
      col: p.col,
      symbol: PIECE_SYMBOL[p.kind],
      kind: p.owner,
      id: p.id,
    });
  }
  return markers;
}

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
      <DemoSection />
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
        <a href="/" className="landing-logo" aria-label="Thresan: Skyflag — home">
          <img
            src="/3phor-logo.png"
            alt=""
            className="landing-logo-img"
          />
          <span className="landing-logo-text">Thresan: Skyflag</span>
        </a>
        <nav className="landing-nav">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="/origins" className="landing-nav-link">Origins</a>
          <a href="/story" className="landing-nav-link">Story</a>
          <a href="#pricing" className="landing-nav-link">Pricing</a>
          <a href="/play" className="landing-cta-button landing-cta-primary landing-cta-small">Play</a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero-inner">
        <img
          src="/3phor-logo.png"
          alt="Thresan: Skyflag"
          className="landing-hero-logo"
        />
        <h1 className="landing-hero-title">Thresan: Skyflag</h1>
        <p className="landing-hero-tagline tagline-script">Three worlds. One proof.</p>
        <p className="landing-hero-subtitle">
          Kaleo Edition. Where strategists gather. Three boards. Four Lifts.
        </p>
        {/* Numeric hero strip — leans on the three-board hook the
            rest of the design is built around. Pure typography, no
            extra art needed. */}
        <ul className="landing-hero-stats" aria-label="At a glance">
          <li><strong>3</strong> boards</li>
          <li><strong>4</strong> piece types</li>
          <li><strong>2</strong> ways to win</li>
        </ul>
        <p className="landing-hero-pitch">
          A turn-based strategy game from the <em>Thresan</em> universe.
          Set in Kaleo, the three-layer arcology where the Aetheri lifted
          what remained of civilization. Lead the Grey Ravens or the
          White Stags. Neutralize the opposing clan's three claim-seals,
          or guide your Captain to the Caelum Nexus.
        </p>
        <div className="landing-hero-actions">
          <a href="/play" className="landing-cta-button landing-cta-primary">
            Play free
          </a>
          <a href="#how-it-works" className="landing-cta-link">
            How it works →
          </a>
        </div>
        <p className="landing-hero-fineprint">
          No account required to start. Solo vs AI, 2P hot-seat, and online
          multiplayer all work in the browser.
        </p>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-section-inner">
        <h2 className="landing-section-title">What makes Skyflag different</h2>
        <div className="landing-features-grid">
          <Feature
            icon="◇◆◇"
            title="Three layers of Kaleo"
            body="Every game plays out simultaneously across the Terran, Meridian, and Empyrean. Lifts move pieces between layers but cost two activations — vertical momentum has to be earned."
          />
          <Feature
            icon="♚♟♜♝"
            title="Four pieces, distinct roles"
            body="Captains neutralize claim-seals. Soldiers advance and promote. Rovers and Pilots transport between layers and leap-capture in close quarters. No piece is interchangeable."
          />
          <Feature
            icon="∞"
            title="Two ways to win"
            body="Neutralize the opposing clan's three claim-seals, or guide your Captain to the Caelum Nexus once the seals are gone. Both paths reward different play styles."
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
            <strong>Deploy.</strong> Each clan starts with four pieces in
            hand and one fixed deploy square on the Terran. Bring them
            onto the board, one activation at a time.
          </li>
          <li>
            <strong>Advance.</strong> Push your Soldier and Captain toward
            the opposing clan's claim-seal corners. Use Rovers and Pilots
            to lift pieces between layers when the path opens up.
          </li>
          <li>
            <strong>Trade and pressure.</strong> Two activations per turn
            means tempo matters. Threats compound across layers — a piece
            that's safe on the Terran may be one lift away from a Meridian
            capture.
          </li>
          <li>
            <strong>Win.</strong> Neutralize all three of the opposing
            clan's claim-seals (Captain lands on the seal square), or
            guide your Captain to the Caelum Nexus once the seals are
            off the board.
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
            <div className="landing-tier-name">Skyflag Plus</div>
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

function DemoSection() {
  // Use whatever theme is first in the registry. THEMES is a record so
  // ordering is insertion-order; the project's "default" theme is
  // always the first entry. If a future theme refactor changes that,
  // pick a specific theme id explicitly.
  const themeId = Object.keys(THEMES)[0] as ThemeId;
  const layerThemes = THEMES[themeId].layers;

  return (
    <section className="landing-section landing-section-alt landing-demo-section">
      <div className="landing-section-inner">
        <h2 className="landing-section-title">Three boards. One game.</h2>
        <p className="landing-demo-lead">
          Every match plays out simultaneously across three 6×6 boards —
          Ground, Sky, Space. Pieces lift between layers, threats compound
          vertically, and a position that's safe on one board can be one
          activation away from collapse on the next.{' '}
          <strong>Three worlds. One proof.</strong>
        </p>

        {/* Optional asset slot — gameplay GIF or short MP4. Drop a file
            into /public/demo.gif (or .mp4) and it'll appear here.
            Falls back to the live SVG demo below when absent. */}
        <DemoAsset />

        <div className="landing-demo-boards">
          {LAYER_ORDER.map((layer) => (
            <div key={layer} className="landing-demo-board-wrap">
              <div className="landing-demo-board-label">
                {layer === 'ground' ? 'Ground' : layer === 'sky' ? 'Sky' : 'Space'}
              </div>
              <Board
                theme={{ ...layerThemes[layer], kind: layer }}
                markers={demoMarkers(layer)}
                deployCells={[]}
                activeDeployPlayer={null}
                selectedCell={null}
                legalTargets={[]}
                onCellClick={() => {}}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Optional gameplay GIF / MP4 placed at /public/demo.gif or
// /public/demo.mp4. The wrapper is hidden until something actually
// loads — avoids the empty-styled-box that <video> renders when its
// src 404s (onError doesn't fire reliably for missing video sources).
function DemoAsset() {
  const [videoOk, setVideoOk] = useState(false);
  const [gifOk, setGifOk] = useState(false);
  const showGif = !videoOk && gifOk;
  const visible = videoOk || gifOk;
  return (
    <div
      className="landing-demo-asset"
      style={{ display: visible ? undefined : 'none' }}
    >
      <video
        className="landing-demo-video"
        src="/demo.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        style={{ display: videoOk ? undefined : 'none' }}
        onLoadedData={() => setVideoOk(true)}
        onError={() => setVideoOk(false)}
      />
      <img
        className="landing-demo-gif"
        src="/demo.gif"
        alt="Skyflag gameplay demo"
        style={{ display: showGif ? undefined : 'none' }}
        onLoad={() => setGifOk(true)}
        onError={() => setGifOk(false)}
      />
    </div>
  );
}

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <strong>Thresan: Skyflag</strong>
          <p className="landing-footer-tagline">Three worlds. One proof.</p>
          <p>By Limnology Research Corp.</p>
        </div>
        <div className="landing-footer-links">
          <a href="/play">Play</a>
          <a href="/story">The Story</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="landing-footer-meta">
          © {new Date().getFullYear()} Limnology Research Corp.
        </div>
      </div>
    </footer>
  );
}
