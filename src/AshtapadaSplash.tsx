// AshtapadaSplash — splash page served at /ashtapada (and later, when
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

const PLAY_URL = 'https://playskyflag.com/play?ref=ashtapada';

export default function AshtapadaSplash() {
  // Override the static index.html meta tags so a share preview from
  // /ashtapada (or ashtapada.com once the domain is live) reads as
  // Ashtapada-branded rather than the Skyflag defaults. Restored on
  // unmount so SPA navigation away from this route is clean.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Ashtapada, lifted. — Thresan: Skyflag';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = desc?.content ?? null;
    if (desc) {
      desc.content =
        'Ashtapada, lifted. Three worlds. One proof. A turn-based strategy game from the Thresan universe.';
    }
    return () => {
      document.title = prevTitle;
      if (desc && prevDesc !== null) desc.content = prevDesc;
    };
  }, []);

  return (
    <div className="ashtapada">
      <main className="ashtapada-inner">
        <img src="/3phor-logo.png" alt="" className="ashtapada-sigil" />
        <p className="ashtapada-eyebrow">Ashtapada, lifted.</p>
        <h1 className="ashtapada-title">Thresan: Skyflag</h1>
        <p className="ashtapada-tagline tagline-script">
          Three worlds. One proof.
        </p>
        <a href={PLAY_URL} className="ashtapada-cta">
          Play
        </a>
        <p className="ashtapada-fineprint">
          A turn-based strategy game from the <em>Thresan</em> universe.
        </p>
      </main>
    </div>
  );
}
