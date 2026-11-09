// AshtapadaSplash, the heritage landing page served at the root of
// ashtapada.com (and at /ashtapada on playskyflag.com for iteration).
//
// A short scrolling page: an animated hero (an 8x8 board draws itself,
// its marked squares glow, then three 6x6 boards lift out of it), a few
// history sections, a timeline from chaturanga to chess, the bridge to
// Thresan, and the calls to action.
//
// Accuracy rules for this page (owner, 8 Nov 2026): keep to what the
// record supports. No "thousands of years", no "millennia", no "root of
// chess" (say "the board chess was born on"), no claim that its play was
// geometric or contemplative, and no sacred names for the board. Every
// historical claim below carries its source in a comment. Claims that
// could not be tied to a source were left out.
//
// Motion rules: every animation starts from a hidden state but the BASE
// styles are the finished, readable state. With prefers-reduced-motion
// the animations are switched off in CSS and the page renders at rest.
// Scroll reveals only arm when JS runs and motion is allowed (see the
// data-reveal attribute), so without JS every section is fully visible.

import { useEffect, useRef, type CSSProperties } from 'react';
import './AshtapadaSplash.css';
import { applySurfaceMeta } from './socialMeta';
import KickstarterCTA from './KickstarterCTA';
import { LAUNCH_LABEL } from './campaign';

const PLAY_URL = 'https://playskyflag.com/?utm_source=ashtapada';
const WAITLIST_URL = 'https://thresan.com/kickstarter?utm_source=ashtapada';
// The Origins page renders on playskyflag.com. On thresan.com the host
// branch in main.tsx renders the umbrella page for every non-universal
// path, so thresan.com/origins would not show Origins. Absolute URL
// because on ashtapada.com every local path re-renders this page.
const ORIGINS_URL = 'https://playskyflag.com/origins?utm_source=ashtapada';

// ─── Hero board geometry ────────────────────────────────────────────
// One cell is 24 user units on every board, so the squares lifted into
// the 6x6 boards are the same size as the squares of the 8x8 floor.
const CELL = 24;
const FLOOR_CY = 340;
// Centre heights of the three lifted boards, bottom to top.
const LIFT_CY = [262, 178, 94];
const LIFT_NAMES = ['terran', 'meridian', 'empyrean'] as const;

// Marked squares on the floor. ILLUSTRATIVE ONLY: surviving boards and
// texts do not give us a settled pattern or meaning for the markings
// (Murray 1913, ch. 2), so this is a decorative choice, said as much in
// the caption.
const MARKED: Array<[number, number]> = [
  [0, 0], [0, 7], [7, 0], [7, 7],
  [3, 3], [3, 4], [4, 3], [4, 4],
];

function isoTransform(cy: number, n: number): string {
  const s = n * CELL;
  return `translate(200 ${cy}) scale(1 0.5) rotate(45) translate(${-s / 2} ${-s / 2})`;
}

function GridLines({ n, className }: { n: number; className: string }) {
  const s = n * CELL;
  const lines = [];
  for (let i = 0; i <= n; i++) {
    const p = i * CELL;
    lines.push(
      <line key={`h${i}`} x1={0} y1={p} x2={s} y2={p} pathLength={1}
        className={className} style={{ '--i': i } as CSSProperties} />,
      <line key={`v${i}`} x1={p} y1={0} x2={p} y2={s} pathLength={1}
        className={className} style={{ '--i': i + 0.5 } as CSSProperties} />,
    );
  }
  return <>{lines}</>;
}

function HeroBoards() {
  const floorS = 8 * CELL;
  const liftS = 6 * CELL;
  return (
    <svg
      className="ash-boards"
      viewBox="0 0 400 420"
      role="img"
      aria-labelledby="ash-boards-title ash-boards-desc"
    >
      <title id="ash-boards-title">Ashtapada, lifted</title>
      <desc id="ash-boards-desc">
        An eight by eight board lies flat, with a few marked squares. Above
        it, three six by six boards are stacked in a column.
      </desc>

      <line className="ash-beam" x1={200} y1={94} x2={200} y2={FLOOR_CY} />

      <g className="ash-floor">
        <g transform={isoTransform(FLOOR_CY, 8)}>
          <rect width={floorS} height={floorS} className="ash-floor-fill" />
          {MARKED.map(([r, c]) => (
            <g key={`${r}-${c}`} className="ash-mark">
              <rect x={c * CELL + 3} y={r * CELL + 3} width={CELL - 6} height={CELL - 6} />
              <path
                d={`M${c * CELL + 6} ${r * CELL + 6} L${c * CELL + CELL - 6} ${r * CELL + CELL - 6} M${c * CELL + CELL - 6} ${r * CELL + 6} L${c * CELL + 6} ${r * CELL + CELL - 6}`}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
          <GridLines n={8} className="ash-floor-line" />
        </g>
      </g>

      <g className="ash-stack">
        {LIFT_CY.map((cy, k) => (
          <g
            key={LIFT_NAMES[k]}
            className={`ash-lift ash-lift-${LIFT_NAMES[k]}`}
            style={{ '--k': k, '--dy': `${FLOOR_CY - cy}px` } as CSSProperties}
          >
            <g transform={`translate(0 7)`}>
              <g transform={isoTransform(cy, 6)}>
                <rect width={liftS} height={liftS} className="ash-lift-edge" />
              </g>
            </g>
            <g transform={isoTransform(cy, 6)}>
              <rect width={liftS} height={liftS} className="ash-lift-fill" />
              <GridLines n={6} className="ash-lift-line" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

export default function AshtapadaSplash() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Per-surface share meta. Restored on unmount.
  useEffect(() => applySurfaceMeta({
    title: 'Ashtapada, the board chess was born on',
    description:
      'Ashtapada, the 8x8 board of ancient India that carried chaturanga, the game that became chess. Its story, and Thresan, a free strategy game that lifts the board into three.',
    canonicalUrl: 'https://ashtapada.com/',
    ogImage: 'https://ashtapada.com/ashtapada-carpet-15c.jpg',
    ogImageAlt: 'Detail of an early 15th century carpet woven with an 8x8 ashtapada board.',
  }), []);

  // Scroll reveals. Armed only when JS runs, IntersectionObserver exists
  // and the visitor has not asked for reduced motion. Until armed, CSS
  // shows everything.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('.ash-reveal'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    root.setAttribute('data-reveal', 'on');
    items.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.removeAttribute('data-reveal');
    };
  }, []);

  return (
    <div className="ashtapada" ref={rootRef}>
      <header className="ash-bar">
        <a href={PLAY_URL} className="ash-brand">
          <img src="/3phor-logo.png" alt="" width={28} height={28} />
          <span>Thresan</span>
        </a>
        <a href={PLAY_URL} className="ash-bar-play">Play free</a>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="ash-hero" aria-labelledby="ash-title">
          <div className="ash-hero-text">
            <p className="ashtapada-eyebrow">aṣṭāpada · ancient India</p>
            <h1 id="ash-title" className="ashtapada-title">Ashtapada</h1>
            <p className="ash-lede">
              The eight-by-eight board of ancient India, and the board
              chess was born on.
            </p>
            <div className="ash-ctas">
              <a href={PLAY_URL} className="ashtapada-cta">Play Thresan free</a>
              <a href={WAITLIST_URL} className="ash-cta-ghost">
                Join the Kickstarter waitlist
              </a>
            </div>
            <a href={ORIGINS_URL} className="ashtapada-more-link">
              Read the full origins →
            </a>
          </div>
          <figure className="ash-hero-figure">
            <HeroBoards />
            <figcaption>
              Sixty-four squares on one plane, lifted into three boards of
              thirty-six: one hundred and eight. Marked squares are
              illustrative.
            </figcaption>
          </figure>
        </section>

        <ul className="ash-facts" aria-label="At a glance">
          <li><strong>8 × 8</strong><span>64 squares, one plane</span></li>
          <li><strong>about 625 CE</strong><span>chaturanga first clearly named</span></li>
          <li><strong>3 × 6 × 6</strong><span>108 squares, Thresan</span></li>
        </ul>

        {/* ── The word ───────────────────────────────────────── */}
        {/* Sources: Murray (1913), ch. 2, on ashtapada as the name of the
            board; Monier-Williams (1899), s.v. aṣṭāpada, gives "a spider"
            and "a board for chess, draughts, etc. having 64 squares".
            Monier-Williams is from training knowledge, not re-read for
            this page [moderate confidence]. */}
        <section className="ash-section ash-reveal" aria-labelledby="ash-word">
          <p className="ash-kicker">01 · The word</p>
          <h2 id="ash-word">Eight-footed, eight-stepped</h2>
          <p>
            <em>Aṣṭāpada</em> is Sanskrit for “eight-footed” or
            “eight-stepped”: a board measured eight squares to a side.
            The same word names a spider, the creature with eight legs,
            and in the Sanskrit dictionaries it also names the playing
            board of sixty-four squares itself.
          </p>
        </section>

        {/* ── The board ──────────────────────────────────────── */}
        {/* Source: Murray (1913), ch. 2. The record supports an 8x8 board
            with some squares marked; the meaning of the markings and the
            rules of play have not come down to us. Image credit as on
            Origins.tsx. */}
        <section className="ash-section ash-reveal" aria-labelledby="ash-board">
          <p className="ash-kicker">02 · The board</p>
          <h2 id="ash-board">Eight rows of eight, some squares marked</h2>
          <figure className="ash-figure">
            <img
              src="/ashtapada-carpet-15c.jpg"
              alt="Detail of an early 15th century carpet woven with an ornate eight by eight ashtapada board, with patterns inside each square."
              width={940}
              height={416}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              Detail of <em>The Chessboard (Ashtapada) Carpet</em>, Central
              Asia or India, early 15th century. Museum of Islamic Art,
              Doha (CA.19.1997). Photograph by Marc Pelletreau, via
              Wikimedia Commons (public domain).
            </figcaption>
          </figure>
          <p>
            Ashtapada was a square board of eight rows of eight. Some of
            its squares carried markings. What those markings meant is
            not known, and the rules of the game played on it have not
            come down to us.
          </p>
        </section>

        {/* ── Games on the board ─────────────────────────────── */}
        {/* Sources: Brahmajala Sutta, Digha Nikaya 1, in Rhys Davids
            (1899), Dialogues of the Buddha, Part I, the list of games
            among the diversions a monk refrains from: games on boards of
            eight and of ten rows, and the same games played on boards
            imagined in the air (Pali akasa). Murray (1913), ch. 2, reads
            ashtapada as a race game. The Pali canon was written down in
            Sri Lanka about the 1st century BCE [moderate confidence,
            standard dating, training knowledge]. */}
        <section className="ash-section ash-reveal" aria-labelledby="ash-games">
          <p className="ash-kicker">03 · Games on the board</p>
          <h2 id="ash-games">Race games, and boards in the air</h2>
          <p>
            Early Buddhist texts name the board among the diversions of
            the day. The <em>Brahmajala Sutta</em> lists games on boards
            of eight rows and of ten rows, and then the same games played
            with no board at all, on boards imagined in the air.
          </p>
          <blockquote className="ash-callout">
            <p>
              Boards “played in the air”: the players held the whole
              grid in their heads.
            </p>
          </blockquote>
          <p>
            The historian H. J. R. Murray read ashtapada as a race game,
            with pieces moving around the board toward a goal. Chess
            was not yet part of the picture.
          </p>
        </section>

        {/* ── Chaturanga ─────────────────────────────────────── */}
        {/* Sources: Murray (1913), chs. 2 to 3. Caturanga, "four limbs",
            the four divisions of the ancient Indian army; first clearly
            referenced about 625 CE in Bana's Harshacharita (trans. Cowell
            and Thomas, 1897). Later piece lineage (infantry to pawn,
            horse to knight, elephant to alfil and the bishop, chariot to
            rukh and the rook) per Murray. */}
        <section className="ash-section ash-reveal" aria-labelledby="ash-chaturanga">
          <p className="ash-kicker">04 · Chaturanga</p>
          <h2 id="ash-chaturanga">Four arms of an army</h2>
          <p>
            In time the board carried a war game. <em>Chaturanga</em>{' '}
            means “four limbs”, the four arms of an ancient Indian army.
            It is first clearly referenced about 625 CE, in Bana’s
            <em> Harshacharita</em>, a prose life of King Harsha.
          </p>
          <ul className="ash-arms">
            <li className="ash-reveal"><span className="ash-arm-sk">padāti</span><strong>Infantry</strong><span className="ash-arm-later">later the pawn</span></li>
            <li className="ash-reveal"><span className="ash-arm-sk">aśva</span><strong>Cavalry</strong><span className="ash-arm-later">later the knight</span></li>
            <li className="ash-reveal"><span className="ash-arm-sk">gaja</span><strong>Elephants</strong><span className="ash-arm-later">later the bishop</span></li>
            <li className="ash-reveal"><span className="ash-arm-sk">ratha</span><strong>Chariots</strong><span className="ash-arm-later">later the rook</span></li>
          </ul>
        </section>

        {/* ── Timeline ───────────────────────────────────────── */}
        {/* Sources, all Murray (1913) unless noted:
            Persia: chatrang; a Middle Persian text, the Wizarishn i
            Chatrang, tells of the game arriving from India at the Sasanian
            court (Murray, ch. 8).
            Shatranj: the Arabic form after the Arab conquest of Persia in
            the mid 7th century; its leading players and problem
            collections are 9th and 10th century (Murray, Part I).
            Europe: reached through al-Andalus and Italy; the earliest
            European reference is the Einsiedeln verses of about 997
            (Murray, Part II).
            Modern chess: the queen and bishop gain their long moves in
            southern Europe about 1475 to 1500 (Murray, Part II, ch. 10).
            Dates are approximate; the page says "about" throughout. */}
        <section className="ash-section ash-reveal" aria-labelledby="ash-west">
          <p className="ash-kicker">05 · The journey west</p>
          <h2 id="ash-west">From chaturanga to chess</h2>
          <ol className="ash-timeline">
            <li className="ash-reveal">
              <span className="ash-when">India</span>
              <h3>Ashtapada</h3>
              <p>The eight-by-eight board, named in early Buddhist texts among the games of the day.</p>
            </li>
            <li className="ash-reveal">
              <span className="ash-when">about 625 CE</span>
              <h3>Chaturanga</h3>
              <p>The four-armed war game, first clearly referenced in Bana’s <em>Harshacharita</em>.</p>
            </li>
            <li className="ash-reveal">
              <span className="ash-when">about 6th to 7th century</span>
              <h3>Chatrang, Persia</h3>
              <p>A Middle Persian text tells of the game arriving from India at the Sasanian court.</p>
            </li>
            <li className="ash-reveal">
              <span className="ash-when">from about 650 CE</span>
              <h3>Shatranj</h3>
              <p>The Arabic name after the conquest of Persia. Its strongest players and problem books date to the 9th and 10th centuries.</p>
            </li>
            <li className="ash-reveal">
              <span className="ash-when">about 1000 CE</span>
              <h3>The medieval European game</h3>
              <p>Chess reaches Europe through Muslim Spain and Italy. The earliest European reference is from about 997.</p>
            </li>
            <li className="ash-reveal">
              <span className="ash-when">about 1475 to 1500</span>
              <h3>Modern chess</h3>
              <p>In southern Europe the queen and bishop gain their long moves, and the game becomes the chess played today.</p>
            </li>
          </ol>
        </section>

        {/* ── Related race games ─────────────────────────────── */}
        {/* Sources: Bell (1960) and Parlett (1999) describe pachisi and
            chaupar as cross-and-circle race games on a cross-shaped board
            with marked safe squares, thrown with cowrie shells (pachisi)
            or long dice (chaupar). Both from training knowledge, not
            re-read for this page [moderate confidence]. No link between
            their safe squares and ashtapada's markings is claimed. */}
        <section className="ash-section ash-reveal" aria-labelledby="ash-race">
          <p className="ash-kicker">06 · Cousins</p>
          <h2 id="ash-race">India’s cross-shaped race games</h2>
          <p>
            India’s best-known race games, <em>pachisi</em> and
            <em> chaupar</em>, are played on a cross-shaped board with
            marked safe squares, using cowrie shells or long dice. Their
            recorded history is much later than ashtapada’s. Whether
            ashtapada’s marked squares worked like their safe squares is
            not known.
          </p>
        </section>

        {/* ── Bridge to Thresan ──────────────────────────────── */}
        <section className="ash-section ash-bridge ash-reveal" aria-labelledby="ash-lift">
          <p className="ash-kicker">07 · Lifted</p>
          <h2 id="ash-lift">From one plane to three</h2>
          <p>
            Chess kept the single plane. <em>Thresan</em> lifts it. The
            eight-by-eight board becomes three stacked six-by-six boards,
            Terran, Meridian and Empyrean. Sixty-four squares become one
            hundred and eight, a number sacred across Hindu, Buddhist and
            Jain practice.
          </p>
          <figure className="ash-figure">
            <img
              src="/thresan-hero-stack.jpg"
              alt="Three stacked game boards rising as a column, the Thresan board."
              width={1672}
              height={941}
              loading="lazy"
              decoding="async"
            />
          </figure>
          <p>
            In the world of <em>Thresan</em> the lift is literal: the
            Aetheri raised what remained of civilization into three
            living layers. Ashtapada was the floor. The Aetheri built the
            sky.
          </p>
          <p className="ashtapada-tagline tagline-script">Three worlds. One proof.</p>
          <div className="ash-ctas ash-ctas-center">
            <a href={PLAY_URL} className="ashtapada-cta">Play Thresan free</a>
            <a href={WAITLIST_URL} className="ash-cta-ghost">
              Join the Kickstarter waitlist
            </a>
          </div>
          <p className="ashtapada-fineprint">
            Free to play in the browser now. The physical edition comes to
            Kickstarter on {LAUNCH_LABEL}.{' '}
            <a href={ORIGINS_URL} className="ashtapada-more-link">Read the full origins →</a>
          </p>
        </section>

        <KickstarterCTA source="ashtapada" />

        <footer className="ash-sources" aria-labelledby="ash-sources-title">
          <h2 id="ash-sources-title">Sources</h2>
          <ul>
            <li>Murray, H. J. R. (1913). <em>A history of chess</em>. Clarendon Press.</li>
            <li>Rhys Davids, T. W. (Trans.). (1899). <em>Dialogues of the Buddha, Part I</em> (Brahmajala Sutta). Oxford University Press.</li>
            <li>Bana. (1897). <em>The Harsa-carita of Bana</em> (E. B. Cowell &amp; F. W. Thomas, Trans.). Royal Asiatic Society.</li>
            <li>Monier-Williams, M. (1899). <em>A Sanskrit-English dictionary</em>. Clarendon Press.</li>
            <li>Bell, R. C. (1960). <em>Board and table games from many civilizations</em>. Oxford University Press.</li>
            <li>Parlett, D. (1999). <em>The Oxford history of board games</em>. Oxford University Press.</li>
            <li>Carpet image: Museum of Islamic Art, Doha (CA.19.1997), photograph by Marc Pelletreau, Wikimedia Commons (public domain).</li>
          </ul>
        </footer>
      </main>
    </div>
  );
}
