// ThresanUmbrella — the page served at thresan.com (the universe-level
// brand surface). Frames Thresan as the world; points the visitor to
// the current product (Skyflag, on www.playskyflag.com) and surfaces
// the physical edition (thresan.store) and the heritage page
// (Origins). Intentionally short — one screen, one primary CTA, two
// secondary links. The job is direction, not depth.

import { useEffect } from 'react';
import './ThresanUmbrella.css';
import { applySurfaceMeta } from './socialMeta';

const GAME_URL = 'https://www.playskyflag.com/?ref=thresan-com';
const STORE_URL = 'https://thresan.store';
const STUDIO_URL = 'https://thresan.studio';
const GAMES_URL = 'https://thresan.games';
const ORIGINS_URL = 'https://www.playskyflag.com/origins?ref=thresan-com';

export default function ThresanUmbrella() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'Thresan — a strategy game and the universe around it',
      description:
        'Thresan is a strategy game with a layered fictional universe. Three boards, four piece types, ancient roots. The current edition is Skyflag.',
      canonicalUrl: 'https://thresan.com/',
      ogImage: 'https://thresan.com/thresan-og-stack.jpg',
      ogImageAlt: 'Three stacked boards forming a column — Terran, Meridian, Empyrean.',
    });
  }, []);

  return (
    <div className="thresan">
      <main className="thresan-inner">
        <img src="/3phor-logo.png" alt="" className="thresan-sigil" />
        <h1 className="thresan-wordmark">
          THRESAN<span className="thresan-tm">™</span>
        </h1>
        <p className="thresan-tagline tagline-script">
          Three worlds. One proof.
        </p>
        <p className="thresan-lead">
          Thresan is a strategy game with a layered universe around
          it. Three stacked boards, four piece types, an ancient
          proof of reach. The current edition is <em>Skyflag</em> —
          the clans, the boards, the world of Kaleo.
        </p>
        <img
          src="/thresan-hero-stack.jpg"
          alt="Three stacked boards forming a column — Terran, Meridian, Empyrean."
          className="thresan-render"
          loading="lazy"
        />
        <a href={GAME_URL} className="thresan-cta">
          Play Skyflag →
        </a>
        <div className="thresan-secondary">
          <a href={GAMES_URL} className="thresan-link">
            The editions of Thresan →
          </a>
          <a href={STORE_URL} className="thresan-link">
            The physical edition →
          </a>
          <a href={ORIGINS_URL} className="thresan-link">
            The origins of Skyflag →
          </a>
          <a href={STUDIO_URL} className="thresan-link">
            Meet the studio →
          </a>
        </div>
        <p className="thresan-fineprint">
          Thresan™ is a project of Limnology Research Corp. ·{' '}
          <a href="https://playskyflag.com/privacy">Privacy</a> ·{' '}
          <a href="https://playskyflag.com/terms">Terms</a>
        </p>
      </main>
    </div>
  );
}
