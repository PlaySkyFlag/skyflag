// ThresanGames, catalog surface served at thresan.games. The editions
// catalog: which editions of Thresan exist, and where to find each.
// Currently lists Skyflag (active) with a forward-compatible ghost
// slot for future editions to signal the catalog framing (the page
// has to read as "the editions of Thresan" even when there's only
// one). Same gold-on-dark palette as the other thresan.* surfaces;
// Terran Sand accent on the .games suffix, the brand color reserved
// for "the lower world, stone, archives", a fit for a catalog.

import { useEffect } from 'react';
import './ThresanGames.css';
import { applySurfaceMeta } from './socialMeta';

const SKYFLAG_URL = 'https://www.playskyflag.com/?ref=thresan-games';
const ORIGINS_URL = 'https://www.playskyflag.com/origins?ref=thresan-games';
const UMBRELLA_URL = 'https://thresan.com';
const STUDIO_URL = 'https://thresan.studio';
const CONTACT_EMAIL = 'njatel@limnology.ca';

export default function ThresanGames() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'The editions, Thresan.games',
      description:
        'The catalog of Thresan editions. The rules are Thresan; each edition brings a new storyboard, new pieces, new boards. Skyflag is the current edition.',
      canonicalUrl: 'https://thresan.games/',
      ogImage: 'https://thresan.games/thresan-og-clans.jpg',
      ogImageAlt: 'Three stacked boards with Grey Ravens and White Stags arrayed across all three planes.',
    });
  }, []);

  return (
    <div className="games">
      <main className="games-inner">
        <img src="/3phor-logo.png" alt="" className="games-sigil" />
        <p className="games-eyebrow">The Catalog</p>
        <h1 className="games-wordmark">
          THRESAN<span className="games-suffix">.games</span>
        </h1>
        <p className="games-tagline tagline-script">
          The editions of Thresan.
        </p>
        <p className="games-lead">
          Thresan is the game, three boards, five piece types, an
          ancient proof of reach. Each edition brings new pieces, new
          board art, and a new storyboard. The rules stay the same.
          This is the catalog.
        </p>

        <section className="games-editions" aria-label="Thresan editions">
          <article className="games-edition games-edition--current">
            <img
              src="/thresan-hero-clans.jpg"
              alt="Three stacked boards with Grey Ravens and White Stags arrayed across all three planes"
              className="games-edition-image"
              loading="lazy"
            />
            <div className="games-edition-body">
              <p className="games-edition-status">Current edition</p>
              <h2 className="games-edition-title">Skyflag</h2>
              <p className="games-edition-storyboard">
                Storyboard: <em>Kaleo</em>. Three stacked arcologies
                lifted from the Earth by the Aetheri. Two clans, the
                Grey Ravens and the White Stags, contest the Caelum
                Nexus.
              </p>
              <p className="games-edition-features">
                Pieces: Captain Dantec, Soldier Durren (promoted to
                Captain Durren on promotion), Rover Thandiwe, Pilot
                Voss. Boards: Terran, Meridian, Empyrean.
              </p>
              <div className="games-edition-actions">
                <a href={SKYFLAG_URL} className="games-cta">
                  Play Skyflag →
                </a>
                <a href={ORIGINS_URL} className="games-link">
                  Read the origins →
                </a>
              </div>
            </div>
          </article>

          <article className="games-edition games-edition--ghost">
            <div className="games-edition-image games-edition-image--ghost">
              <img
                src="/3phor-logo.png"
                alt=""
                className="games-edition-ghost-sigil"
              />
            </div>
            <div className="games-edition-body">
              <p className="games-edition-status">In design</p>
              <h2 className="games-edition-title">Edition II</h2>
              <p className="games-edition-storyboard">
                Quiet on this one for now. The rules are Thresan; the
                storyboard is being written.
              </p>
              <p className="games-edition-foot">
                Want to know when the next edition launches? Email{' '}
                <a href={`mailto:${CONTACT_EMAIL}?subject=Future editions`}>
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          </article>
        </section>

        <a href="https://thresan.com/kickstarter" className="games-cta games-cta-ks">
          Notify me, Kickstarter October 27, 2026 →
        </a>

        <div className="games-outbound">
          <a href="https://thresan.com/world" className="games-link">
            The world of Kaleo →
          </a>
          <a href={UMBRELLA_URL} className="games-link">
            The universe (thresan.com) →
          </a>
          <a href={STUDIO_URL} className="games-link">
            The studio (thresan.studio) →
          </a>
        </div>

        <p className="games-fineprint">
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
