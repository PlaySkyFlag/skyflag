// ThresanStudio — served at thresan.studio. The "who's behind this"
// surface: short note from the creator, the brothers/holiday-table
// origin story that became Skyflag, and two outward CTAs. Same shape
// as ThresanUmbrella (one screen, gold-on-dark) so the brand reads
// consistently across thresan.com / .store / .studio.

import { useEffect } from 'react';
import './ThresanStudio.css';
import { applySurfaceMeta } from './socialMeta';

const GAME_URL = 'https://www.playskyflag.com/?ref=thresan-studio';
const STORE_URL = 'https://thresan.store';
const LINKEDIN_URL = 'https://ca.linkedin.com/in/nelsonjatel';

export default function ThresanStudio() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'The studio — Thresan™ by Nelson Jatel',
      description:
        'Thresan is built by Nelson Jatel — a water researcher in Kelowna, BC. Three brothers, a holiday table, and the game that came out of it.',
      canonicalUrl: 'https://thresan.studio/',
      ogImage: 'https://thresan.studio/thresan-og-studio.jpg',
      ogImageAlt: 'Portrait of Nelson Jatel — the creator behind Thresan.',
    });
  }, []);

  return (
    <div className="studio">
      <main className="studio-inner">
        <img src="/3phor-logo.png" alt="" className="studio-sigil" />
        <p className="studio-eyebrow">A note from the studio</p>
        <h1 className="studio-name">Nelson Jatel</h1>
        <p className="studio-where">Kelowna, British Columbia</p>

        <img
          src="/nelson-jatel.jpg"
          alt="Portrait of Nelson Jatel"
          className="studio-portrait"
          width={160}
          height={160}
        />

        <div className="studio-prose">
          <p>
            By day I support watershed management and am an adjunct
            professor at UBCO — Limnologist and Doctor of Social
            Sciences, working on water governance and the social
            networks that shape it.
          </p>
          <p>
            Thresan™ came out of somewhere else entirely. My two
            brothers and I have spent every holiday for as long as I
            can remember gathered around a board game. Three of us, the
            same table, the same long afternoons. <em>Three worlds.
            One proof.</em> is, in the end, a sentence about us.
          </p>
          <p>
            Thresan is the game — three stacked boards, four piece
            types, an ancient proof of reach. <em>Skyflag</em> is its
            current edition: the clans, the boards, the storyboard set
            in the world of Kaleo. Built solo, on evenings and
            weekends, with my brothers and friends as the first
            playtesters. A physical edition of Skyflag follows when
            the Kickstarter lines up.
          </p>
        </div>

        <a href={GAME_URL} className="studio-cta">
          Play Skyflag →
        </a>
        <div className="studio-secondary">
          <a href={STORE_URL} className="studio-link">
            The physical edition →
          </a>
          <a
            href={LINKEDIN_URL}
            className="studio-link"
            target="_blank"
            rel="noreferrer"
          >
            Day-job résumé (LinkedIn) →
          </a>
        </div>

        <p className="studio-fineprint">
          Thresan™ is a project of Limnology Research Corp. ·{' '}
          <a href="https://playskyflag.com/privacy">Privacy</a> ·{' '}
          <a href="https://playskyflag.com/terms">Terms</a>
        </p>
      </main>
    </div>
  );
}
