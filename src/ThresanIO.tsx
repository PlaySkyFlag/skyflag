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
              directions, four corners. But every
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

        <article className="lab-post">
          <header className="lab-post-header">
            <p className="lab-post-meta">Lab note · 2026-05-13 · Nelson</p>
            <h2 className="lab-post-title">Why the Nexus has one column</h2>
            <p className="lab-post-subtitle">
              The decision-tree behind the single vertical axis, and
              what happens to the search space when you add a second.
            </p>
          </header>

          <div className="lab-post-body">
            <p>
              The Caelum Nexus sits at <em>space(3,3)</em> — a single
              square, at the top of a single column running through
              all three boards. It's one of the two ways to win
              Thresan: get your Captain there.
            </p>
            <p>
              When I sketched early versions of the rules, the Nexus
              had more than one location. Two columns, sometimes
              four, once a ring of six. Every version felt worse.
              Three planes already make strategy complex; adding
              redundant win-paths made it noisy.
            </p>
            <p>
              The single column makes the game tighter for three reasons.
            </p>

            <h3>1. It forces commitment</h3>
            <p>
              With multiple Nexus columns, a Captain in trouble could
              pivot to a different column mid-game. With one column,
              the decision <em>I'm racing to the Nexus</em> is made
              once, and the rest of the game tests whether you can
              defend that commitment. The contest gets sharper.
            </p>

            <h3>2. The branching factor stays sane</h3>
            <p>
              Each Nexus column the AI has to evaluate adds a
              multiplier to the search space at every ply. Two
              columns roughly doubles the strategic possibilities the
              engine has to consider. Four columns quadruples it.
              With one column, the engine can search the <em>actual</em>{' '}
              tactical depth instead of spending budget on positional
              shuffles between equivalent goals.
            </p>

            <h3>3. It clarifies the proof</h3>
            <p>
              <em>Three worlds. One proof.</em> — the win condition
              is a single demonstration of vertical reach. With four
              Nexus columns, the proof would be "any one of four
              reaches." That's a different kind of statement. Cleaner
              geometry, weaker meaning.
            </p>

            <p>
              The single column is also what makes flag-capture a
              meaningful alternative win path. With multiple Nexus
              columns, flag-capture would feel like a side quest.
              With one column, flag-capture is the <em>defensive</em>{' '}
              win path: you can't get to the top, so you sweep the
              bottom. Two paths, balanced against each other —
              because there's exactly one of each.
            </p>

            <p className="lab-post-signoff">— Nelson</p>
          </div>
        </article>

        <article className="lab-post">
          <header className="lab-post-header">
            <p className="lab-post-meta">Lab note · 2026-05-13 · Nelson</p>
            <h2 className="lab-post-title">From Ashtapada to Thresan</h2>
            <p className="lab-post-subtitle">
              The thirteen centuries between the eighth-century
              pattern and the three-board lift. With the math.
            </p>
          </header>

          <div className="lab-post-body">
            <p>
              The eight-by-eight board predates chess by several
              hundred years. <em>Ashtapada</em> — Sanskrit for
              "eight-footed," the eight squares on each side — was a
              race game played in India well before Chaturanga
              (chess's direct ancestor) appeared in the sixth century.
              The board itself was older than the rules anyone now
              plays on it.
            </p>
            <p>
              Chess took the eight-by-eight floor and added six piece
              types, a turn-based structure, and a single win
              condition. The game became one of the most-played
              strategic systems in human history. The board didn't
              change.
            </p>
            <p>
              Thresan asks a different question: what happens if we
              keep the board's <em>idea</em> (the disciplined grid)
              but lift it into three dimensions?
            </p>
            <p>
              The naive answer is "you get 3D chess" — and the
              history of that suggests it doesn't work. Most 3D-chess
              variants end up unplayable: too many pieces, too many
              planes, the rules ramify until the game stops being
              legible. Star Trek 3D chess is famous, but it's famous
              because it looks cool on a coffee table, not because
              anyone seriously plays it.
            </p>

            <h3>The trick Thresan tries to thread</h3>
            <ul className="lab-post-list">
              <li>
                <strong>Smaller grid.</strong> 6×6 instead of 8×8.
                Three 36-square boards give 108 squares total —
                meaningfully larger than chess's 64, but each plane
                stays small enough that a human can read it at a
                glance.
              </li>
              <li>
                <strong>Fewer pieces.</strong> Five per player
                instead of sixteen. The game stays positionally
                legible: every piece matters, every move counts.
              </li>
              <li>
                <strong>Constrained vertical movement.</strong> Lifts
                at fixed positions (1,1), (1,4), (4,1), (4,4).
                Pieces can only change planes via these — no free
                transit. The third dimension is a strategic asset,
                not noise.
              </li>
            </ul>

            <h3>The math, loosely</h3>
            <p>
              <strong>Chess:</strong> 64 squares × 16 pieces × ~30
              average legal moves per turn — a search space measured
              in roughly 10^120 possible games.
            </p>
            <p>
              <strong>Thresan:</strong> 108 squares × 10 pieces × ~20
              average legal moves per turn. The branching factor is
              lower (fewer pieces), the board is larger (more
              squares), and the layer dimension adds a{' '}
              <em>qualitative</em> primitive — <em>do I go up?</em> —
              that chess doesn't have.
            </p>
            <p>
              The end position-count for Thresan is hard to estimate
              without running it, but the game-tree complexity is
              probably in the same neighbourhood as chess — possibly
              slightly higher because of the layer transitions,
              possibly lower because of the smaller piece count.
              Either way, it's deep enough to be a real strategy
              game and shallow enough that an engine can actually
              evaluate positions meaningfully.
            </p>

            <p>
              The thirteen centuries from Ashtapada to Thresan aren't
              about getting to a better game than chess. Chess is one
              of the great inventions of human strategic culture.
              Thresan is about asking a question chess never had to:{' '}
              <em>what does strategy look like when the floor lifts?</em>
            </p>
            <p>
              Three boards. Five piece types. One Nexus. One question.
            </p>

            <p className="lab-post-signoff">— Nelson</p>
          </div>
        </article>

        <article className="lab-post">
          <header className="lab-post-header">
            <p className="lab-post-meta">Lab note · 2026-05-13 · Nelson</p>
            <h2 className="lab-post-title">Thresan in the 3D-chess lineage</h2>
            <p className="lab-post-subtitle">
              Where this game sits in 175 years of multi-board chess
              variants.
            </p>
          </header>

          <div className="lab-post-body">
            <p>
              The 3D-chess tradition is older than most people
              realise. The first attempt — Kubicschach — was published
              in 1851, when Lionel Kieseritzky stacked eight 8×8
              boards on top of each other and tried to play. The
              result was unplayable, but the <em>idea</em> persisted.
              Every few decades since, someone has taken another
              swing.
            </p>
            <p>
              Thresan is the newest entry in that tradition, and the
              first to balance the game through computational
              simulation rather than design intuition. Here's where
              it fits.
            </p>

            <h3>The lineage</h3>
            <table className="lab-post-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Game</th>
                  <th>Geometry</th>
                  <th>Designer</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>1851</td><td>Kubicschach</td><td>8 × (8×8)</td><td>Lionel Kieseritzky</td></tr>
                <tr><td>1907</td><td>Raumschach</td><td>5 × (5×5)</td><td>Ferdinand Maack</td></tr>
                <tr><td>1967</td><td>The Original 3D Chess</td><td>3 × (8×8)</td><td>Lynn R. Johnson (NASA)</td></tr>
                <tr><td>1973</td><td>Strato Chess</td><td>3 × (8×8)</td><td>Dynamic Games</td></tr>
                <tr><td>1975</td><td>Tri-Dimensional Chess</td><td>3 × (4×4) + 4 × (2×2) movable</td><td>Franz Joseph Schnaubelt</td></tr>
                <tr><td>1985</td><td>Dragonchess</td><td>3 × (8×12)</td><td>Gary Gygax</td></tr>
                <tr><td>1996</td><td>Hyperchess</td><td>helical</td><td>Max Chappell</td></tr>
                <tr><td>2001</td><td>Millennium 3D Chess</td><td>3 × (8×8)</td><td>William d'Agostino</td></tr>
                <tr><td>2026</td><td><strong>Thresan: Skyflag</strong></td><td>3 × (6×6)</td><td>Nelson Regan Jatel</td></tr>
              </tbody>
            </table>
            <p>
              <em>(Dates and designers per BGG's 3D-Chess family
              entry; not independently verified against primary
              sources.)</em>
            </p>

            <h3>What Thresan does differently</h3>
            <ul className="lab-post-list">
              <li>
                <strong>Smallest playable 3D geometry.</strong> 3 ×
                (6×6) = 108 cells, versus Raumschach's 125 and
                Strato/Millennium's 192. Sub-hour games and
                single-session learnability.
              </li>
              <li>
                <strong>No checkmate.</strong> Thresan replaces the
                contradiction-style win condition with two
                constructive paths: capture all three claim-seals, or
                land the Captain on the Caelum Nexus.
              </li>
              <li>
                <strong>Cross-Board Rule.</strong> Captures route
                through opposite-side Lifts. Parallel boards become
                integrated geometry; Lift control becomes the central
                positional question.
              </li>
              <li>
                <strong>Simulation-balanced.</strong> Around 6,700
                Monte Carlo self-play games converged the current
                ruleset. Empirical balance rather than design
                intuition.
              </li>
              <li>
                <strong>Optional narrative frame.</strong> The
                world of Kaleo (Aetheri, clans, the lift) doesn't
                affect play. Pieces and boards carry it; rules don't.
              </li>
            </ul>

            <h3>The arc that got us here</h3>
            <p>
              Thresan's design has gone through twelve numbered
              iterations across roughly three years. The central
              event was the <em>v17 → v19</em> arc — the Cross-Board
              Rule transforming the game from parallel three-board
              race to integrated three-dimensional position game.
            </p>
            <ul className="lab-post-list">
              <li>
                <strong>v10–v13</strong> (2024 to early 2025).
                Foundation. Three-layer 6×6 geometry, Lifts at the
                four current positions, the five-piece roster.
              </li>
              <li>
                <strong>v14</strong> (mid-2025). Tightest measured
                balance gap in the series (1.9%). Established the
                simulation methodology.
              </li>
              <li>
                <strong>v16</strong> (late 2025). Raid mechanic.
                Corner flags, isolated Lifts, cross-board capture
                concept introduced.
              </li>
              <li>
                <strong>v17</strong> (early 2026). First Cross-Board
                Rule implementation. Surfaced the "RoverLock"
                exploit.
              </li>
              <li>
                <strong>v19</strong> (April 2026). Cross-Board Rule
                v2 — RoverLock eliminated. Revealed a 31.5% P1
                advantage gap.
              </li>
              <li>
                <strong>v20</strong> (May 2026). Format expansion:
                solo, two-player hot-seat, and online play. No
                mechanical change.
              </li>
              <li>
                <strong>v21</strong> (current). Brand pivot —
                Exedra / 3phor → Thresan: Skyflag. No rule change.
              </li>
            </ul>

            <h3>What this isn't</h3>
            <p>
              A claim that Thresan is better than chess. Chess is one
              of the great inventions of human strategic culture.
              Thresan is asking a different question — <em>what does
              strategy look like when the floor lifts?</em> — and
              trying to answer it in the smallest, cleanest geometry
              that holds together.
            </p>
            <p>
              Three boards. Five piece types. One Nexus. One proof.
            </p>

            <p className="lab-post-signoff">— Nelson</p>
          </div>
        </article>

        <section className="lab-roadmap">
          <h2 className="lab-roadmap-title">In the works</h2>
          <ul className="lab-roadmap-list">
            <li>
              <strong>Curriculum of openings.</strong> How the engine
              learns positional fundamentals — and the first dozen
              openings worth knowing.
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
          Thresan™ is a project of Limnology Research Corp. ·{' '}
          <a href="https://playskyflag.com/privacy">Privacy</a> ·{' '}
          <a href="https://playskyflag.com/terms">Terms</a> ·{' '}
          <a href="https://playskyflag.com/ai-use">AI use</a>
        </p>
      </main>
    </div>
  );
}
