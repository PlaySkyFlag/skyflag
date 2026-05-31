// AshtapadaSplash, splash page served at /ashtapada (and later, when
// the domain is wired up, at the root of ashtapada.com). One screen,
// one CTA: the gold sigil, an eyebrow that bridges the URL to the
// game, the rally line, and a single Play button that hands the
// visitor off to the main game on playskyflag.com.
//
// Lives separately from Landing.tsx because Landing carries the full
// marketing scroll (features, pricing, demo). A visitor who typed
// ashtapada.com should not have to scroll to find Play.

import { useEffect } from 'react';
import './AshtapadaSplash.css';
import { applySurfaceMeta } from './socialMeta';

const PLAY_URL = 'https://playskyflag.com/play?ref=ashtapada';
// Absolute URL so the link works from both ashtapada.com (where the
// hostname check would re-render the splash on any local path) and
// from playskyflag.com/ashtapada during in-browser iteration.
const ORIGINS_URL = 'https://playskyflag.com/origins?ref=ashtapada';

export default function AshtapadaSplash() {
  // Override the static index.html meta tags so a share preview from
  // /ashtapada (or ashtapada.com once the domain is live) reads as
  // Ashtapada-branded rather than the Skyflag defaults. Restored on
  // unmount so SPA navigation away from this route is clean.
  useEffect(() => applySurfaceMeta({
    title: 'Ashtapada, lifted., Thresan™: Skyflag',
    description:
      'Ashtapada, lifted. Three worlds. One proof. Thresan: a strategy game, currently in its Skyflag edition.',
    canonicalUrl: 'https://ashtapada.com/',
    ogImage: 'https://ashtapada.com/thresan-og-stack.jpg',
    ogImageAlt: 'Three stacked boards rising as a column, Ashtapada lifted into Thresan.',
  }), []);

  return (
    <div className="ashtapada">
      <main>
        <section className="ashtapada-hero">
          <div className="ashtapada-inner">
            <img src="/3phor-logo.png" alt="" className="ashtapada-sigil" />
            <p className="ashtapada-eyebrow">Ashtapada, lifted.</p>
            <h1 className="ashtapada-title">Thresan™: Skyflag</h1>
            <p className="ashtapada-tagline tagline-script">
              Three worlds. One proof.
            </p>
            <a href={PLAY_URL} className="ashtapada-cta">
              Play
            </a>
            <p className="ashtapada-fineprint">
              <em>Thresan</em>, a strategy game. Currently in its{' '}
              <em>Skyflag</em> edition.
            </p>
            <img
              src="/thresan-hero-stack.jpg"
              alt="Three stacked boards rising as a column, the Ashtapada lifted."
              className="ashtapada-render"
              loading="lazy"
            />
          </div>
        </section>

        <section className="ashtapada-more" aria-label="Origins">
          <div className="ashtapada-more-inner">
            <p className="ashtapada-more-eyebrow">Origins</p>
            <p className="ashtapada-more-prose">
              Ashtapada is one of the oldest known board games, the
              eight-by-eight grid that ancient India played for thousands
              of years, and the same grid that, centuries later, carried
              Chaturanga west into Persia and eventually became chess.
              Skyflag returns to that root and takes a different fork.
              Where chess kept the single plane, Skyflag lifts it: three
              stacked six-by-six boards, sixty-four squares opened to one
              hundred and eight. In the world of <em>Thresan</em>, the
              lift is literal, the Aetheri raised what remained of
              civilization into three living layers, and the game
              ascended with the city. Ashtapada was the floor. The
              Aetheri built the sky.
            </p>
            <a href={ORIGINS_URL} className="ashtapada-more-link">
              Read the full origins →
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
