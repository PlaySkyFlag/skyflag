// ThresanUmbrella, the page served at thresan.com (the universe-level
// brand surface). Frames Thresan as the world; points the visitor to
// the current product (Skyflag, on www.playskyflag.com) and surfaces
// the physical edition (thresan.store) and the heritage page
// (Origins). Intentionally short, one screen, one primary CTA, two
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
      title: 'Thresan, a strategy game and the universe around it',
      description:
        'Thresan is a strategy game with a layered fictional universe. Three boards, five piece types, ancient roots. The current edition is Skyflag.',
      canonicalUrl: 'https://thresan.com/',
      ogImage: 'https://thresan.com/thresan-og-stack.jpg',
      ogImageAlt: 'Three stacked boards forming a column, Terran, Meridian, Empyrean.',
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
          it. Three stacked boards, five piece types, an ancient
          proof of reach. The current edition is <em>Skyflag</em>          the clans, the boards, the world of Kaleo.
        </p>
        <img
          src="/thresan-hero-stack.jpg"
          alt="Three stacked boards forming a column, Terran, Meridian, Empyrean."
          className="thresan-render"
          loading="lazy"
        />
        <div className="thresan-video">
          <video
            className="thresan-video-el"
            src="/thresan-gameplay.mp4"
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            Your browser doesn&rsquo;t support inline video.{' '}
            <a href="/thresan-gameplay.mp4" download>
              Download the clip
            </a>{' '}
            instead.
          </video>
        </div>
        <p className="thresan-lead thresan-video-caption">
          This is Thresan in play, three stacked boards (Ground, Sky,
          and Space), five pieces a side moving across all three planes
          at once, lifting between worlds to set up captures no flat
          board could hold. The game is{' '}
          <strong>free to play, always</strong>, jump in below. The
          premium physical board launches on{' '}
          <strong>Kickstarter on October 27, 2026</strong>.{' '}
          <a href={STORE_URL}>Sign up now</a> to get the launch email.
        </p>
        <a href={GAME_URL} className="thresan-cta">
          Play Skyflag free →
        </a>
        <div className="thresan-secondary">
          <a href="/world" className="thresan-link">
            The world of Kaleo →
          </a>
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
        <a href="https://thresan.com/kickstarter" className="thresan-cta">
          Notify me, Kickstarter, October 27, 2026 →
        </a>
        <p className="thresan-fineprint">
          © {new Date().getFullYear()} Limnology Research Corp. ·{' '}
          Thresan™ is a project of Limnology Research Corp. ·{' '}
          <a href="https://playskyflag.com/privacy">Privacy</a> ·{' '}
          <a href="https://playskyflag.com/terms">Terms</a> ·{' '}
          <a href="https://playskyflag.com/ai-use">AI use</a>
        </p>
      </main>
    </div>
  );
}
