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
      ogImage: 'https://thresan.io/thresan-og-nexus.jpg',
      ogImageAlt: 'The Caelum Nexus column glowing through three stacked boards.',
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

        <article className="lab-post">
          <header className="lab-post-header">
            <p className="lab-post-meta">Lab note · 2026-05-13 · Nelson</p>
            <h2 className="lab-post-title">The proof of three</h2>
            <p className="lab-post-subtitle">
              Why three planes is the smallest number that makes
              Thresan stop being chess.
            </p>
          </header>

          <div className="lab-post-body">
            <p>
              When I started designing Thresan, the first question I
              had to answer was the simplest one: <em>how many
              boards?</em>
            </p>
            <p>
              The temptation was four. Four feels deliberate — four
              directions, four piece types, four corners. But every
              time I sketched a four-plane version, the middle two
              planes became transit space. Pieces moved <em>through</em>{' '}
              them on the way somewhere else, but the planes themselves
              didn't matter. The strategic question collapsed back to{' '}
              <em>where on the top board</em> and <em>where on the
              bottom board</em>. The middle was tax.
            </p>
            <p>
              Two planes was the other extreme. Two planes gives you
              exactly one decision: up or down. The vertical dimension
              exists but doesn't produce strategy — it produces a
              binary toggle. You're playing chess with a slightly
              bigger board.
            </p>
            <p>Three planes is different.</p>
            <p>
              With three planes, the vertical question becomes{' '}
              <em>positional</em>. Where on the column you sit changes
              what you can threaten and what can threaten you. The
              middle is not transit. The middle is a third theater of
              contest. A piece on Meridian isn't on its way somewhere —
              it's in a position no piece on Terran or Empyrean can
              occupy. The plane itself carries strategic information.
            </p>
            <p>
              That's the smallest viable form of what I started calling{' '}
              <em>vertical strategy</em>: a piece's depth in the stack
              matters as much as its file and rank. Two planes can't
              have vertical strategy; the column is too short. Four
              planes have it but with so much surface area that the
              engine and the human both lose the thread.
            </p>
            <p>Three planes is the threshold.</p>

            <h3>What this has to do with "proof"</h3>
            <p>
              The game's tagline is <em>Three worlds. One proof.</em>{' '}
              When I wrote that I meant it precisely.
            </p>
            <p>
              In chess, the win condition is <em>check the opponent's
              king</em>. It's a contradiction-style claim: the loser
              has been put in a position they can't escape. The proof
              is by elimination of moves.
            </p>
            <p>
              Thresan's win conditions are different. There are two:
            </p>
            <ol className="lab-post-list">
              <li>
                <strong>Capture all three of the opposing clan's
                claim-seals.</strong> One seal lives on each plane. To
                win this way you've demonstrated control across all
                three theaters — you've proved you can reach into
                every depth of the world.
              </li>
              <li>
                <strong>Land your Captain on the Caelum Nexus</strong>{' '}
                at the top of the stack. To win this way you've
                demonstrated that a single piece, escorted up through
                your own play, can traverse the full column.
              </li>
            </ol>
            <p>
              Both win conditions are <em>constructive</em> proofs.
              You don't win by trapping the opponent. You win by
              building a positional structure that demonstrates reach
              across the three planes. The game ends when one side has
              assembled the proof.
            </p>
            <p>
              That's why three planes matters. Two planes can't host a
              proof of reach — the column is too short for "reach" to
              be the right word. Four planes host one but at the cost
              of legibility. Three is the smallest number where the
              proof feels like a proof rather than a coincidence.
            </p>

            <h3>The smallest interesting strategic surface</h3>
            <p>
              I think of it the way a topologist thinks of dimensions.
              Two-dimensional strategy is a closed system; you can map
              every position and the strategic frontier is bounded.
              Add a third dimension naively and the search space
              explodes, but the <em>strategic primitives</em> don't
              change.
            </p>
            <p>
              Add a third dimension with the right constraints — three
              planes, fixed-position Lifts, a single Nexus axis, and
              clan pieces that move differently relative to their
              plane — and you get a new strategic surface. Not chess
              on stilts. Something else.
            </p>
            <p>
              That's what Thresan tries to be. The smallest extension
              of two-dimensional strategy that gives you genuinely new
              strategic primitives. Three was the answer.
            </p>

            <p className="lab-post-signoff">— Nelson</p>
          </div>
        </article>

        <section className="lab-roadmap">
          <h2 className="lab-roadmap-title">In the works</h2>
          <ul className="lab-roadmap-list">
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
            next post ships it'll surface on this page. If you want
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
