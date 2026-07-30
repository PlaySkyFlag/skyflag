// ThresanUmbrella, the page served at thresan.com (the universe-level
// brand surface). Frames Thresan as the world; points the visitor to
// the current product (Skyflag, on www.playskyflag.com) and surfaces
// the physical edition (thresan.store) and the heritage page
// (Origins). Intentionally short, one screen, one primary CTA, two
// secondary links. The job is direction, not depth.

import { useEffect } from 'react';
import './ThresanUmbrella.css';
import SiteHeader from './SiteHeader';
import { applySurfaceMeta } from './socialMeta';
import { track } from '@vercel/analytics';
import { campaignCta, campaignUrl, currentPhase } from './campaign';

const GAME_URL = 'https://www.playskyflag.com/?ref=thresan-com';
const STORE_URL = 'https://thresan.store';
const STUDIO_URL = 'https://thresan.studio';
const GAMES_URL = 'https://thresan.games';
const ORIGINS_URL = 'https://www.playskyflag.com/origins?ref=thresan-com';

export default function ThresanUmbrella() {
  const phase = currentPhase();
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
        <SiteHeader role="Universe" />
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
          and Space), four pieces a side moving across all three planes
          at once, lifting between worlds to set up captures no flat
          board could hold. The game is{' '}
          <strong>free to play, always</strong>, jump in below. The
          premium physical board launches on{' '}
          <strong>Kickstarter on October 27, 2026</strong>.{' '}
        </p>

        {/* ── One ask ──────────────────────────────────────────────
            During the campaign this surface has a single job: send the
            visitor to Follow. It used to offer eight roughly-equal
            choices (play, five section links, a store signup, and a
            second CTA), which is the definition of a page that competes
            with itself. Follow is now the only prominent action; play
            stays as one quiet secondary because free play is the
            funnel; the section links are demoted to a plain nav row so
            they still exist without contending for the click. */}
        <a
          href={campaignUrl(phase, 'umbrella')}
          target="_blank"
          rel="noopener noreferrer"
          className="thresan-cta"
          onClick={() => track('banner_cta_click', { surface: 'umbrella', phase })}
        >
          {campaignCta(phase)}
        </a>
        <p className="thresan-cta-microcopy">
          {phase === 'LIVE'
            ? 'Campaign closes November 27, 2026.'
            : 'Free, one tap. A single notification on launch day.'}
        </p>
        <p className="thresan-cta-secondary">
          Not sure yet? <a href={GAME_URL}>The full game is free to play →</a>
        </p>

        <nav className="thresan-secondary" aria-label="More about Thresan">
          <a href="/world" className="thresan-link">
            The world of Kaleo
          </a>
          <a href={GAMES_URL} className="thresan-link">
            Editions
          </a>
          <a href={STORE_URL} className="thresan-link">
            Physical edition
          </a>
          <a href={ORIGINS_URL} className="thresan-link">
            Origins
          </a>
          <a href={STUDIO_URL} className="thresan-link">
            Studio
          </a>
        </nav>
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
