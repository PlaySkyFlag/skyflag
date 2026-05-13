// ThresanUmbrella — the page served at thresan.com (the universe-level
// brand surface). Frames Thresan as the world; points the visitor to
// the current product (Skyflag, on www.playskyflag.com) and surfaces
// the physical edition (thresan.store) and the heritage page
// (Origins). Intentionally short — one screen, one primary CTA, two
// secondary links. The job is direction, not depth.

import { useEffect } from 'react';
import './ThresanUmbrella.css';

const GAME_URL = 'https://www.playskyflag.com/?ref=thresan-com';
const STORE_URL = 'https://thresan.store';
const ORIGINS_URL = 'https://www.playskyflag.com/origins?ref=thresan-com';

export default function ThresanUmbrella() {
  useEffect(() => {
    window.scrollTo(0, 0);
    const prevTitle = document.title;
    document.title = 'Thresan — a universe of strategy games and stories';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = desc?.content ?? null;
    if (desc) {
      desc.content =
        'Thresan is a layered fictional world. Its first game is Skyflag — three stacked boards, ancient roots, ongoing campaign.';
    }
    return () => {
      document.title = prevTitle;
      if (desc && prevDesc !== null) desc.content = prevDesc;
    };
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
          A universe of strategy games and stories. Three stacked
          arcologies, four clans, and an ancient proof of reach. The
          first game is <em>Skyflag</em>.
        </p>
        <a href={GAME_URL} className="thresan-cta">
          Play Skyflag →
        </a>
        <div className="thresan-secondary">
          <a href={STORE_URL} className="thresan-link">
            The physical edition →
          </a>
          <a href={ORIGINS_URL} className="thresan-link">
            The origins of Skyflag →
          </a>
        </div>
        <p className="thresan-fineprint">
          Thresan™ is a project of Limnology Research Corp.
        </p>
      </main>
    </div>
  );
}
