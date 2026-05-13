// Origins — heritage page. Connects Ashtapada (the ~ancient Indian
// 8×8 board game, board-ancestor of chess via Chaturanga) to Skyflag
// (three 6×6 boards) and bridges into the Thresan mythology. Linked
// from the Landing nav and excerpted on the Ashtapada splash so the
// same body of copy serves visitors arriving from either surface.

import { useEffect } from 'react';
import './Origins.css';
import { applySurfaceMeta } from './socialMeta';

export default function Origins() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'Origins — Thresan™: Skyflag',
      description:
        'How Ashtapada — one of the oldest known board games — became Thresan: the eight-by-eight grid lifted into three boards. Currently in its Skyflag edition.',
      canonicalUrl: 'https://playskyflag.com/origins',
    });
  }, []);

  return (
    <div className="origins">
      <Header />
      <main>
        <Hero />
        <article className="origins-article">
          <AshtapadaSection />
          <LineageSection />
          <LiftSection />
          <ThresanSection />
          <Sources />
        </article>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="origins-header">
      <div className="origins-header-inner">
        <a href="/" className="origins-back" aria-label="Back to Skyflag">
          ← Skyflag
        </a>
        <div className="origins-header-meta">Origins</div>
        <a href="/play" className="origins-cta-button">Play</a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="origins-hero">
      <p className="origins-hero-eyebrow">Origins</p>
      <h1 className="origins-hero-title">From Ashtapada, lifted.</h1>
      <p className="origins-hero-lead">
        Skyflag descends from one of the oldest known games in the world.
        This is how an eight-by-eight grid from ancient India became three
        boards, six by six, lifted into the sky.
      </p>
    </section>
  );
}

function AshtapadaSection() {
  return (
    <section className="origins-section">
      <h2 className="origins-section-title">Ashtapada</h2>
      <figure className="origins-figure">
        <img
          src="/ashtapada-carpet-15c.jpg"
          alt="Detail of an early-15th-century carpet showing an ornate 8×8 ashtapada board, with intricate patterns woven inside each square."
          className="origins-figure-img"
          loading="lazy"
        />
        <figcaption className="origins-figure-caption">
          Detail of <em>The Chessboard (Ashtapada) Carpet</em>, Central
          Asia or India, early 15th century. Museum of Islamic Art, Doha
          (CA.19.1997). Photograph by Marc Pelletreau. Via Wikimedia
          Commons (public domain).
        </figcaption>
      </figure>
      <p className="origins-prose">
        Ashtapada is one of the oldest known board games. Played in
        ancient India for thousands of years, on a square board of eight
        by eight — <em>aṣṭāpada</em>, "eight-stepped." Pieces moved along
        the grid; the strategy was geometric and contemplative; the game
        predates chess by millennia.
      </p>
    </section>
  );
}

function LineageSection() {
  return (
    <section className="origins-section">
      <h2 className="origins-section-title">The line that became chess</h2>
      <p className="origins-prose">
        Around the sixth century, Ashtapada's board carried a new game —
        Chaturanga, four armies in concert. Chaturanga travelled west and
        became Shatranj in Persia, then chess in Europe. The board
        persisted; the pieces and rules evolved away from their root.
        Skyflag returns to that root, and takes a different fork.
      </p>
    </section>
  );
}

function LiftSection() {
  return (
    <section className="origins-section">
      <h2 className="origins-section-title">The lift</h2>
      <figure className="origins-figure">
        <img
          src="/skyflag-render-tower.jpg"
          alt="Skyflag board concept render: three transparent 6×6 boards stacked vertically — Ground at the base, Sky in the middle, Space at the top — supported by a central column on a metallic base."
          className="origins-figure-img"
          loading="lazy"
        />
        <figcaption className="origins-figure-caption">
          Skyflag — concept render of the three-board stack: Terran
          (Ground), Meridian (Sky), Empyrean (Space).
        </figcaption>
      </figure>
      <p className="origins-prose">
        Where chess preserved the eight-by-eight plane, Skyflag lifts it.
        The single grid becomes three stacked grids — Terran, Meridian,
        Empyrean — six by six each. Sixty-four squares become one hundred
        and eight. The mechanical change is a numerical one too: in the
        tradition that gave us Ashtapada, 108 is the count that runs
        through cosmology, prayer, and breath. Three worlds. One proof.
      </p>
    </section>
  );
}

function ThresanSection() {
  return (
    <section className="origins-section">
      <h2 className="origins-section-title">The Thresan frame</h2>
      <figure className="origins-figure">
        <img
          src="/skyflag-render-fan.jpg"
          alt="Skyflag board concept render: three glowing 6×6 boards fanned out from a central illuminated hub — green Ground, cyan Sky, blue Space — each set with metallic chess-like pieces."
          className="origins-figure-img"
          loading="lazy"
        />
        <figcaption className="origins-figure-caption">
          Skyflag — concept render, fan-spread arrangement.
        </figcaption>
      </figure>
      <p className="origins-prose">
        Within the Thresan universe, the lift is literal. After the long
        collapse, the Aetheri raised what remained of civilization up
        into three living layers — and the game, like the city, ascended
        with it. Ashtapada was the floor. The Aetheri built the sky.
      </p>
      <p className="origins-rally tagline-script">
        Skyflag is Ashtapada, lifted.
      </p>
    </section>
  );
}

function Sources() {
  return (
    <section className="origins-sources">
      <h2 className="origins-sources-title">Sources &amp; image credits</h2>
      <ul className="origins-sources-list">
        <li>
          <em>The Chessboard (Ashtapada) Carpet</em>, early 15th century.
          Museum of Islamic Art, Doha (CA.19.1997). Photograph: Marc
          Pelletreau.{' '}
          <a
            href="https://commons.wikimedia.org/wiki/File:The_Chessboard_(Ashtapada)_Carpet_(detail).jpg"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikimedia Commons (public domain) →
          </a>
        </li>
        <li>
          <a
            href="https://en.wikipedia.org/wiki/Ashtapada"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ashtapada — Wikipedia
          </a>
        </li>
        <li>
          <a
            href="https://en.wikipedia.org/wiki/Chaturanga"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chaturanga — Wikipedia
          </a>
        </li>
        <li>
          Skyflag board renders by the Skyflag project (concept art).
        </li>
      </ul>
    </section>
  );
}

function Footer() {
  return (
    <footer className="origins-footer">
      <div className="origins-footer-inner">
        <p className="origins-footer-mark">Thresan™: Skyflag</p>
        <p className="origins-footer-tagline tagline-script">
          Three worlds. One proof.
        </p>
        <p className="origins-footer-links">
          <a href="/">Home</a> · <a href="/story">The Story</a> ·{' '}
          <a href="/play">Play</a> ·{' '}
          <a href="https://thresan.store">Edition</a>
        </p>
        <p className="origins-footer-meta">
          © {new Date().getFullYear()} Limnology Research Corp.
        </p>
      </div>
    </footer>
  );
}
