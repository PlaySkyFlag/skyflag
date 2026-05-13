// ThresanIO — engineering / lab surface served at thresan.io. The
// behind-the-boards content: engine internals, opening theory, build
// journal. Same gold-on-dark palette as the other thresan.* surfaces
// so the umbrella reads coherently; an Aether Copper accent on .io
// (the brand color for "machinery, lifts, forged metal") quietly
// signals this is the engineering register.

import { useEffect } from 'react';
import './ThresanIO.css';
import { applySurfaceMeta } from './socialMeta';

const GAME_URL = 'https://www.playskyflag.com/?ref=thresan-io';
const UMBRELLA_URL = 'https://thresan.com';
const STUDIO_URL = 'https://thresan.studio';
const CONTACT_EMAIL = 'njatel@limnology.ca';

export default function ThresanIO() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'The Lab — Thresan.io',
      description:
        'Engine notes, opening theory, and the build journal behind Thresan™: Skyflag. The math behind the boards.',
      canonicalUrl: 'https://thresan.io/',
    });
  }, []);

  return (
    <div className="lab">
      <main className="lab-inner">
        <img src="/3phor-logo.png" alt="" className="lab-sigil" />
        <p className="lab-eyebrow">The Lab</p>
        <h1 className="lab-wordmark">
          THRESAN<span className="lab-suffix">.io</span>
        </h1>
        <p className="lab-tagline tagline-script">
          The math behind the boards.
        </p>
        <p className="lab-lead">
          This is where the engineering lives. Engine notes for
          Thresan (the game), opening theory, and the build journal
          behind the <em>Skyflag</em> edition. Read what's behind the
          boards.
        </p>

        <section className="lab-roadmap">
          <h2 className="lab-roadmap-title">In the works</h2>
          <ul className="lab-roadmap-list">
            <li>
              <strong>The proof of three.</strong> What the Aetheri Law
              of Three means in game mechanics — and why three planes
              is the smallest number that lets strategy stop being chess.
            </li>
            <li>
              <strong>Why the Nexus has one column.</strong> The
              decision-tree behind the single vertical axis, and what
              happens to the search space when you add a second.
            </li>
            <li>
              <strong>Curriculum of openings.</strong> How the engine
              learns positional fundamentals — and the first dozen
              openings worth knowing.
            </li>
            <li>
              <strong>From Ashtapada to Thresan.</strong> The thirteen
              centuries between the eighth-century pattern and the
              three-board lift. With the math.
            </li>
            <li>
              <strong>Build journal — weeks 1 to 12.</strong> Honest
              notes on what worked and what didn't in the first three
              months of construction.
            </li>
          </ul>
          <p className="lab-roadmap-foot">
            No newsletter yet. The lab is in slow build — when the
            first post ships it'll surface on this page. If you want
            to know when, reply by email:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="lab-mail">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <div className="lab-outbound">
          <a href={GAME_URL} className="lab-link">
            Play Skyflag →
          </a>
          <a href={UMBRELLA_URL} className="lab-link">
            The universe (thresan.com) →
          </a>
          <a href={STUDIO_URL} className="lab-link">
            The studio (thresan.studio) →
          </a>
        </div>

        <p className="lab-fineprint">
          Thresan™ is a project of Limnology Research Corp.
        </p>
      </main>
    </div>
  );
}
