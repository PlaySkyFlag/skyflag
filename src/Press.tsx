// Press — media kit page for journalists, content creators, and anyone
// covering Thresan™: Skyflag. Modeled after dopresskit.com conventions:
// quick-facts table, multiple description lengths (so any word-count
// budget fits), feature bullets, history, downloadable assets, founder
// bio, contact. Every text block is selectable so a journalist can
// copy-paste straight into their CMS.

import { useEffect } from 'react';
import './Press.css';
import { applySurfaceMeta } from './socialMeta';

const PRESS_EMAIL = 'njatel@limnology.ca';
const PRESS_SUBJECT = '[Press] Thresan: Skyflag';

export default function Press() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'Press kit — Thresan™: Skyflag',
      description:
        'Press kit for Thresan™: Skyflag — fact sheet, descriptions, logos, renders, trailer, and contact for journalists and content creators.',
      canonicalUrl: 'https://playskyflag.com/press',
      ogImage: 'https://playskyflag.com/thresan-og-clans.jpg',
      ogImageAlt: 'Three stacked boards with Grey Ravens and White Stags arrayed across all three planes.',
    });
  }, []);

  return (
    <div className="press">
      <Header />
      <main>
        <Hero />
        <article className="press-article">
          <QuickFacts />
          <Trailer />
          <Descriptions />
          <Features />
          <History />
          <Assets />
          <About />
          <Contact />
        </article>
      </main>
      <Footer />
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="press-header">
      <div className="press-header-inner">
        <a href="/" className="press-back" aria-label="Back to Thresan: Skyflag">
          ← Thresan™: Skyflag
        </a>
        <div className="press-header-meta">Press Kit</div>
        <a href="/play" className="press-cta-button">Play</a>
      </div>
    </header>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="press-hero">
      <p className="press-hero-eyebrow">Press Kit</p>
      <h1 className="press-hero-title">Thresan™: Skyflag</h1>
      <p className="press-hero-tagline">
        A turn-based strategy game played simultaneously across three
        stacked boards.
      </p>
      <img
        src="/thresan-hero-clans.jpg"
        alt="Thresan: Skyflag — three stacked boards with Grey Ravens and White Stags arrayed across all three planes."
        className="press-hero-render"
      />
      <p className="press-hero-fineprint">
        Everything on this page is free to use in coverage. Take what
        you need.
      </p>
    </section>
  );
}

// ─── Trailer ───────────────────────────────────────────────────────

function Trailer() {
  return (
    <section className="press-section">
      <h2 className="press-section-title">Trailer</h2>
      <div className="press-trailer">
        <video
          className="press-trailer-video"
          src="/thresan-skyflag-trailer.mp4"
          controls
          preload="metadata"
          playsInline
        >
          Your browser doesn't support inline video.{' '}
          <a href="/thresan-skyflag-trailer.mp4" download>
            Download the trailer
          </a>{' '}
          instead.
        </video>
      </div>
      <p className="press-section-note">
        <strong>What you'll see.</strong> The trailer opens on a single
        round of stone — the eighth-century <em>Ashtapada</em> board,
        weathered, rotating under amber light. The Ashtapada lifts; a
        second board fades in beneath it, then a third. Three planes
        stacked like the floors of an arcology — Terran, Meridian,
        Empyrean. The clans assemble across all three: Grey Ravens and
        White Stags, five pieces per side. A short sequence of moves
        follows — a Captain crossing a Lift, a Pilot threading the
        Empyrean, a Nexus capture decided in three dimensions — set
        against tactile foley and a single low cello. Pieces freeze in
        their final position; the three boards become a single column
        of light. Cards: <strong>Three worlds. One proof.</strong>{' '}
        <strong>Thresan™: Skyflag.</strong> <em>playskyflag.com</em>.
      </p>
      <p className="press-section-note">
        <a href="/thresan-skyflag-trailer.mp4" download>
          Download the trailer (MP4) →
        </a>
      </p>
    </section>
  );
}

// ─── Quick facts ───────────────────────────────────────────────────

function QuickFacts() {
  return (
    <section className="press-section">
      <h2 className="press-section-title">At a glance</h2>
      <table className="press-facts">
        <tbody>
          <tr><th>Title</th><td>Thresan™: Skyflag</td></tr>
          <tr><th>Designer</th><td>Nelson Jatel</td></tr>
          <tr><th>Publisher</th><td>Limnology Research Corp.</td></tr>
          <tr><th>Genre</th><td>Turn-based strategy · abstract · 3-board chess descendant</td></tr>
          <tr><th>Players</th><td>1–2 (solo vs AI, hot-seat, online multiplayer)</td></tr>
          <tr><th>Age</th><td>8+</td></tr>
          <tr><th>Length</th><td>45–75 minutes</td></tr>
          <tr><th>Languages</th><td>English</td></tr>
          <tr><th>Platforms</th><td>Web (browser), iOS (TestFlight, in development)</td></tr>
          <tr><th>Price (digital)</th><td>Free · optional Plus tier $4.99/month</td></tr>
          <tr><th>Physical edition</th><td>Coming to Kickstarter — reservations at thresan.store</td></tr>
          <tr><th>Release</th><td>Live now at <a href="https://playskyflag.com">playskyflag.com</a></td></tr>
          <tr><th>Rulebook</th><td>v20, Cross-Board Rule — <a href="/3phor-rulebook.pdf">PDF</a></td></tr>
          <tr><th>Press contact</th><td><a href={`mailto:${PRESS_EMAIL}?subject=${encodeURIComponent(PRESS_SUBJECT)}`}>{PRESS_EMAIL}</a></td></tr>
        </tbody>
      </table>
    </section>
  );
}

// ─── Descriptions (three lengths, copy-friendly) ───────────────────

function Descriptions() {
  return (
    <section className="press-section">
      <h2 className="press-section-title">Descriptions</h2>
      <p className="press-section-note">
        Three lengths to fit any word-count budget. Select the text and
        copy — all blocks are plain text.
      </p>

      <div className="press-desc">
        <h3 className="press-desc-label">One-line (≈ 20 words)</h3>
        <p className="press-desc-body">
          Thresan™: Skyflag is a free, browser-based turn-based strategy
          game played simultaneously across three stacked 6×6 boards.
        </p>
      </div>

      <div className="press-desc">
        <h3 className="press-desc-label">Short (≈ 60 words)</h3>
        <p className="press-desc-body">
          Thresan™: Skyflag is a free turn-based strategy game from
          designer Nelson Jatel and Limnology Research Corp. Two
          players command five pieces — Captain, Soldier, Promoted
          Soldier Captain, Rover, Pilot — across three stacked 6×6 boards. Capture the opposing clan's
          three claim-seals, then guide your Captain to the Caelum
          Nexus to win. No dice. No cards. Pure geometry.
        </p>
      </div>

      <div className="press-desc">
        <h3 className="press-desc-label">Long (≈ 180 words)</h3>
        <p className="press-desc-body">
          Thresan™: Skyflag is a free, browser-based turn-based strategy
          game played simultaneously across three stacked 6×6 boards: the
          Terran, Meridian, and Empyrean layers of an arcology called
          Kaleo. Each of the two players commands five pieces (Captain,
          Soldier, Promoted Soldier Captain, Rover, Pilot) and wins one of
          two ways: capture the opposing Captain and Soldier, or capture
          the opposing clan's three flags, one on each layer, and then land
          a Captain on the Caelum Nexus at Space(3,3).
        </p>
        <p className="press-desc-body">
          Pieces move and capture by geometry alone. There are no
          special abilities, no cards, no dice. The game descends from
          Ashtapada — one of the oldest known board games, played in
          ancient India for thousands of years and the same 8×8 grid
          that, centuries later, carried Chaturanga west to become
          chess. Skyflag returns to that root and takes a different
          fork: three stacked grids, sixty-four squares opened to one
          hundred and eight. A premium physical edition is in
          development; pre-Kickstarter reservations open at
          thresan.store.
        </p>
      </div>
    </section>
  );
}

// ─── Features ──────────────────────────────────────────────────────

function Features() {
  return (
    <section className="press-section">
      <h2 className="press-section-title">Features</h2>
      <ul className="press-features">
        <li>
          <strong>Three layers of Kaleo.</strong> Every game plays out
          simultaneously across Terran, Meridian, and Empyrean. Lifts
          move pieces between layers but cost two activations.
        </li>
        <li>
          <strong>Five pieces, distinct roles.</strong> Captains
          neutralize claim-seals. Soldiers advance and promote into
          Promoted Soldier Captains. Rovers and Pilots transport between
          layers.
        </li>
        <li>
          <strong>Two ways to win.</strong> Neutralize the opposing
          clan's three claim-seals, or guide your Captain to the
          Caelum Nexus once the seals are off the board.
        </li>
        <li>
          <strong>A real AI.</strong> Iterative-deepening minimax with
          alpha-beta pruning, transposition tables, quiescence search,
          killer-move heuristic, null-move pruning, late-move
          reduction, and a tuned opening book.
        </li>
        <li>
          <strong>Time controls + daily puzzle.</strong> Untimed,
          blitz, or rapid. A new tactical puzzle every 24 hours, same
          position for everyone.
        </li>
        <li>
          <strong>Online play with ratings.</strong> Sign in (or stay
          as guest), invite by code or link, asynchronous play with
          push notifications. ELO-tracked. Free.
        </li>
      </ul>
    </section>
  );
}

// ─── History ───────────────────────────────────────────────────────

function History() {
  return (
    <section className="press-section">
      <h2 className="press-section-title">History</h2>
      <p className="press-desc-body">
        Ashtapada is one of the oldest known board games — the 8×8
        grid that ancient India played for thousands of years. Around
        the sixth century, that board carried a new game called
        Chaturanga, which travelled west to become Shatranj in Persia
        and eventually chess in Europe. The board persisted; the
        pieces and rules evolved away from their root.
      </p>
      <p className="press-desc-body">
        Thresan™: Skyflag returns to that root and takes a different
        fork. Where chess preserved the eight-by-eight plane, Skyflag
        lifts it. The single grid becomes three stacked grids — Terran,
        Meridian, Empyrean — six by six each. Sixty-four squares
        become one hundred and eight. The full historical lineage and
        the in-universe Thresan mythology are documented at{' '}
        <a href="/origins">playskyflag.com/origins</a>.
      </p>
    </section>
  );
}

// ─── Assets (logos, renders, photos) ───────────────────────────────

function Assets() {
  return (
    <section className="press-section">
      <h2 className="press-section-title">Assets</h2>
      <p className="press-section-note">
        Right-click any image and choose "Save Image As…" to download
        full resolution. All assets free for editorial use.
      </p>

      <div className="press-asset-grid">
        <figure className="press-asset">
          <a href="/3phor-logo.png" download>
            <img src="/3phor-logo.png" alt="Thresan sigil on dark — gold concentric arcs pierced by a vertical line" />
          </a>
          <figcaption>
            <strong>Logo — gold on dark</strong>
            <span>768×768 PNG · primary brand mark</span>
          </figcaption>
        </figure>

        <figure className="press-asset">
          <a href="/3phor-mark.png" download>
            <img src="/3phor-mark.png" alt="Thresan sigil on white — black concentric arcs pierced by a vertical line" />
          </a>
          <figcaption>
            <strong>Logo — black on white</strong>
            <span>256×256 PNG · for light backgrounds</span>
          </figcaption>
        </figure>

        <figure className="press-asset">
          <a href="/skyflag-screenshot-home.png" download>
            <img src="/skyflag-screenshot-home.png" alt="Thresan: Skyflag app home view — branded splash above the game controls" />
          </a>
          <figcaption>
            <strong>App — home view</strong>
            <span>1400px PNG · in-app lobby with brand splash</span>
          </figcaption>
        </figure>

        <figure className="press-asset">
          <a href="/thresan-hero-clans.jpg" download>
            <img src="/thresan-hero-clans.jpg" alt="Three stacked boards with Grey Ravens and White Stags arrayed across all three planes" />
          </a>
          <figcaption>
            <strong>Render — clans on three planes</strong>
            <span>1920px JPG · both clans in starting positions</span>
          </figcaption>
        </figure>

        <figure className="press-asset">
          <a href="/thresan-hero-lift.jpg" download>
            <img src="/thresan-hero-lift.jpg" alt="Figurine being lifted between planes on a column of gold light" />
          </a>
          <figcaption>
            <strong>Render — the Lift, mid-arc</strong>
            <span>1920px JPG · piece transiting between planes</span>
          </figcaption>
        </figure>

        <figure className="press-asset">
          <a href="/thresan-hero-nexus.jpg" download>
            <img src="/thresan-hero-nexus.jpg" alt="Glowing Aether figure suspended above the topmost board in the Nexus column" />
          </a>
          <figcaption>
            <strong>Render — the Caelum Nexus</strong>
            <span>1920px JPG · Aether figure in the Nexus column</span>
          </figcaption>
        </figure>

        <figure className="press-asset">
          <a href="/thresan-hero-stack.jpg" download>
            <img src="/thresan-hero-stack.jpg" alt="Three stacked boards rising as a column, no figures" />
          </a>
          <figcaption>
            <strong>Render — stack, no figures</strong>
            <span>1920px JPG · architectural / brand-card variant</span>
          </figcaption>
        </figure>

        <figure className="press-asset">
          <a href="/thresan-card.jpg" download>
            <img src="/thresan-card.jpg" alt="Brand card — sigil, Thresan wordmark, Skyflag subhead, 'Three worlds. One proof.', thresan.com" />
          </a>
          <figcaption>
            <strong>Brand card</strong>
            <span>1920px JPG · sigil + wordmark lockup, dark background</span>
          </figcaption>
        </figure>

        <figure className="press-asset">
          <a href="/thresan-prototype-kitchen.jpg" download>
            <img src="/thresan-prototype-kitchen.jpg" alt="Three-tier cardboard prototype on a kitchen counter, with painted figurines as pieces" />
          </a>
          <figcaption>
            <strong>First prototype — kitchen</strong>
            <span>The hand-built version that came before the renders</span>
          </figcaption>
        </figure>

        <figure className="press-asset">
          <a href="/ashtapada-carpet-15c.jpg" download>
            <img src="/ashtapada-carpet-15c.jpg" alt="Detail of a 15th-century carpet showing an ornate ashtapada (8×8) board" />
          </a>
          <figcaption>
            <strong>Ashtapada carpet (15th c.)</strong>
            <span>
              Museum of Islamic Art, Doha · public domain via Wikimedia Commons ·
              photo: Marc Pelletreau · use with credit
            </span>
          </figcaption>
        </figure>
      </div>

      <p className="press-section-note">
        <strong>Coming soon:</strong> board / gameplay screenshots and
        photographs of the 3D-printed prototype. Email for early access.
      </p>
    </section>
  );
}

// ─── About the designer ────────────────────────────────────────────

function About() {
  return (
    <section className="press-section">
      <h2 className="press-section-title">About the designer</h2>
      <p className="press-desc-body">
        Thresan™: Skyflag is designed by Nelson Jatel, working
        solo under Limnology Research Corp. The game has been in
        active design and play since 2025, evolving from a hand-built
        cardboard prototype on a kitchen counter through twenty-plus
        rulebook revisions to the version published today. The Thresan
        universe extends beyond the game itself — additional titles
        and stories are in development.
      </p>
      <p className="press-section-note">
        A longer biographical / studio-process piece is in preparation
        at thresan.studio.
      </p>
    </section>
  );
}

// ─── Contact ───────────────────────────────────────────────────────

function Contact() {
  return (
    <section className="press-section">
      <h2 className="press-section-title">Contact &amp; boilerplate</h2>

      <p className="press-desc-body">
        For interviews, review codes, advance access, or anything
        else:{' '}
        <a href={`mailto:${PRESS_EMAIL}?subject=${encodeURIComponent(PRESS_SUBJECT)}`}>
          {PRESS_EMAIL}
        </a>
      </p>

      <h3 className="press-desc-label">Boilerplate (copy-paste)</h3>
      <p className="press-desc-body press-boilerplate">
        Thresan™: Skyflag is a free, browser-based, turn-based strategy
        game from designer Nelson Jatel and Limnology Research
        Corp. Players command five pieces across three stacked 6×6
        boards (Terran, Meridian, Empyrean), pursuing the opposing
        clan's three claim-seals and the Caelum Nexus. The game
        descends from Ashtapada — the ancient Indian board that, via
        Chaturanga, eventually became chess. A premium physical
        edition is coming to Kickstarter. Play at playskyflag.com.
      </p>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="press-footer">
      <div className="press-footer-inner">
        <p className="press-footer-mark">Thresan™: Skyflag</p>
        <p className="press-footer-links">
          <a href="/">Home</a> · <a href="/origins">Origins</a> ·{' '}
          <a href="/story">The Story</a> ·{' '}
          <a href="https://thresan.com">Universe</a> ·{' '}
          <a href="https://thresan.games">Editions</a> ·{' '}
          <a href="https://thresan.store">Edition</a> ·{' '}
          <a href="https://thresan.studio">Studio</a> ·{' '}
          <a href="https://thresan.io">Lab</a> ·{' '}
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{' '}
          <a href="/ai-use">AI use</a>
        </p>
        <p className="press-footer-meta">
          © {new Date().getFullYear()} Nelson Jatel · Limnology Research Corp.
        </p>
      </div>
    </footer>
  );
}
