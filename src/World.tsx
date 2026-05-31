// World — "The World of Kaleo" codex, served at /world (aliasable to a
// thresan.world host later). The lore hub of the ecosystem: it explains
// the universe the game is set in, and — crucially — shows that the four
// game pieces ARE the four Aetheri templates. studio (read the comic) →
// world (why this universe matters) → games (catalog) → store (back it).
//
// Copy is adapted faithfully from the v21 Lore Brief; art is the rulebook
// character/world plates. Same gold-on-dark palette as the thresan.*
// surfaces, declared with literal values so it renders standalone.

import { useEffect } from 'react';
import './World.css';
import { applySurfaceMeta } from './socialMeta';

const GAME_URL = 'https://www.playskyflag.com/?ref=thresan-world';
const STORE_URL = 'https://thresan.store';
const STUDIO_URL = 'https://thresan.studio';
const READER_URL = 'https://thresan.studio/volume-zero';
const GAMES_URL = 'https://thresan.games';
const ORIGINS_URL = 'https://www.playskyflag.com/origins?ref=thresan-world';
const RULEBOOK_URL = '/thresan-skyflag-rulebook.pdf';

type Clan = {
  name: string;
  sub: string;
  totem: string;
  mark: string;
  conviction: string;
  attribution: string;
  body: string;
};

const CLANS: Clan[] = [
  {
    name: 'The Grey Ravens',
    sub: 'Memory, custody, and the discipline of waiting',
    totem:
      'The raven — long memory, high vantage, and the patience to watch a situation for as long as observation alone can teach, acting only when action is the last option left.',
    mark: 'Slate field-coats, black collar accents; a black flight-feather at the collar in formal rank — always from a bird that died of age.',
    conviction:
      '“We have been here longer than the crisis. We will be here longer than its answer.”',
    attribution: 'Grey Raven field maxim',
    body: 'Heir to the containment tradition. The Ravens believe Kaleo survived its worst collapse through patience and archival memory, and that Aetheri inheritance is to be preserved, not spent. A Raven would rather let a generation die than waste a protocol whose function is not yet understood — not from cruelty, but from a hard-won belief that survival depends on keeping more than Kaleo can currently understand.',
  },
  {
    name: 'The White Stags',
    sub: 'Traverse, urgency, and the legitimacy of reaching',
    totem:
      'The stag — endurance across distance and the will to complete a traverse once begun, because a half-finished ascent is worse than one never attempted.',
    mark: 'Bone-ivory field-coats, warm gold accents; an antler fragment at the shoulder in formal rank — always from a stag that completed a full-depth traverse.',
    conviction:
      '“We were given a path. If we do not walk it, it becomes a monument to our refusal.”',
    attribution: 'White Stag field maxim',
    body: 'Heir to the escalation tradition. The Stags believe the Aetheri were engineers who built tools and vanished — and that tools exist to be used. A Stag would rather consume an irreplaceable protocol to save a generation than preserve it intact for a future that may never arrive. Not recklessness, but a belief that legitimacy is measured by what a people does, not by what it keeps.',
  },
];

type Template = {
  name: string;
  role: string;
  img: string;
  psych: string;
  aug: string;
  game: string;
};

const TEMPLATES: Template[] = [
  {
    name: 'Dantec',
    role: 'The Captain',
    img: '/kaleo-captain.jpg',
    psych:
      'Perspective and judgment. Trained to read a situation as a pattern of choices and consequences.',
    aug: 'A skullbase implant recognizes Aetheri seal authorization and grants king-move geometry.',
    game: 'Moves a single step in any direction: the only piece that can capture the enemy clan’s seals and finish on the Nexus.',
  },
  {
    name: 'Durren',
    role: 'The Soldier',
    img: '/kaleo-soldier.jpg',
    psych:
      'Action and pressure tolerance. Keeps forward motion under conditions that would freeze a planner.',
    aug: 'Lower-spine augmentation steadies performance under fatigue — and carries a latent Dantec implant, dormant since training.',
    game: 'The forward edge. Cross the full Terran depth under live opposition and the implant wakes: the Soldier becomes a Captain. The promotion is a medical event, not a metaphor.',
  },
  {
    name: 'Thandiwe',
    role: 'The Rover',
    img: '/kaleo-rover.jpg',
    psych:
      'Order and systems thinking. Reads the arcology as a machine where every corridor has a function.',
    aug: 'Holds the Lift-occupancy state of all four columns, across all three layers, in working memory.',
    game: 'Controls the vertical. Stand in the right square on the right layer and an entire Lift column locks — no weapon required, only presence.',
  },
  {
    name: 'Voss',
    role: 'The Pilot',
    img: '/kaleo-pilot.jpg',
    psych:
      'Curiosity and geometric intuition. Recognizes paths that exist only because of angle and timing.',
    aug: 'Visual-cortex augmentation projects sight-line overlays onto ordinary vision.',
    game: 'The angle-finder. Threatens along lines that open through the stack at the precise moment they exist.',
  },
];

export default function World() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'The World of Kaleo — Thresan™: Skyflag',
      description:
        'A world suspended above a world that failed. Kaleo: the three-layer arcology, the Grey Ravens and White Stags, the four Aetheri templates, and the silent Nexus at the summit. The universe behind Thresan: Skyflag.',
      canonicalUrl: 'https://thresan.com/world',
      ogImage: 'https://thresan.com/kaleo-arcology.jpg',
      ogImageAlt:
        'The three stacked layers of the Kaleo arcology rising into light — Terran, Meridian, Empyrean.',
    });
  }, []);

  return (
    <div className="world">
      <main className="world-inner">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <header className="world-hero">
          <img src="/3phor-logo.png" alt="" className="world-sigil" />
          <p className="world-eyebrow">The World of</p>
          <h1 className="world-title">KALEO</h1>
          <p className="world-tagline tagline-script">
            A world suspended above a world that failed.
          </p>
          <img
            src="/kaleo-arcology.jpg"
            alt="The three stacked layers of the Kaleo arcology rising into light — Terran at the base, Meridian in the middle, Empyrean at the summit."
            className="world-hero-art"
          />
          <p className="world-hero-credit">
            The three layers of the Kaleo arcology
          </p>
        </header>

        {/* ── Kaleo & the Aetheri ──────────────────────────────── */}
        <section className="world-section">
          <h2 className="world-section-title">The arcology</h2>
          <div className="world-prose">
            <p>
              Long ago, when the planet below gave way to salt, dust, and
              ruined basins, the <strong>Aetheri</strong> lifted what
              remained of civilization into a three-layer arcology. The{' '}
              <strong>Terran</strong> became the world of reservoirs,
              farms, and crowded districts. Above it, the{' '}
              <strong>Meridian</strong> carried charged air and the old
              routing systems that governed movement between sectors. At
              the summit stood the <strong>Empyrean</strong> — the quiet
              upper shell, and at its dead center, the Caelum Nexus.
            </p>
            <p>
              The Aetheri did not trust survival to strength alone. They
              built Kaleo as a system of proofs — a law of geometry and
              consequence binding the arcology to the Nexus. They left no
              armies. They left protocols, seals, and a single question
              waiting at the top of the world.
            </p>
          </div>
          <figure className="world-figure">
            <img
              src="/kaleo-aetheri.jpg"
              alt="An ethereal Aetheri being suspended in a crystal chamber, threaded with light."
              className="world-figure-img"
              loading="lazy"
            />
            <figcaption>
              The Aetheri — engineers who built the proof, then vanished.
            </figcaption>
          </figure>
        </section>

        {/* ── The Schism ───────────────────────────────────────── */}
        <section className="world-section world-section-alt">
          <h2 className="world-section-title">The schism</h2>
          <figure className="world-figure world-figure-wide">
            <img
              src="/kaleo-grey-hollow.jpg"
              alt="A dim corridor in the lower Terran sectors during the Grey Hollow."
              className="world-figure-img"
              loading="lazy"
            />
            <figcaption>
              The lower Terran sectors, where the Hollow always spreads
              first.
            </figcaption>
          </figure>
          <div className="world-prose">
            <p>
              Six centuries after founding, the first real crisis came —
              the <strong>First Hollow</strong>, a wasting sickness that
              spread through the oldest, thirstiest districts. The Aetheri
              records were opened for the first time in living memory, and
              with them a dangerous possibility: the Nexus could still
              answer. It might even release the protocols to arrest the
              sickness — but only under the Law of Three, and no one alive
              had stood before it under the full proof.
            </p>
            <p>
              One faction argued to <strong>open everything</strong> and
              petition the Nexus under whatever partial proof could be
              assembled. The other argued for <strong>containment</strong>{' '}
              — preserve the inheritance, refuse panic, let the Nexus stay
              silent rather than risk an ungoverned answer.
            </p>
            <p>
              Containment won by one vote. It stabilized Kaleo — and two
              hundred thousand Terran residents died who might have been
              saved. The escalation faction never forgot. Over four
              generations the two sides hardened into clans.
            </p>
          </div>
          <blockquote className="world-pullquote">
            The schism persists because both arguments remain defensible.
            Neither clan has resolved the question. Both have only
            committed to opposite answers.
          </blockquote>
        </section>

        {/* ── The Two Clans ────────────────────────────────────── */}
        <section className="world-section">
          <h2 className="world-section-title">The two clans</h2>
          <div className="world-clans">
            {CLANS.map((c) => (
              <article key={c.name} className="world-clan">
                <h3 className="world-clan-name">{c.name}</h3>
                <p className="world-clan-sub">{c.sub}</p>
                <p className="world-clan-body">{c.body}</p>
                <p className="world-clan-line">
                  <span className="world-clan-label">Totem</span>
                  {c.totem}
                </p>
                <p className="world-clan-line">
                  <span className="world-clan-label">Mark</span>
                  {c.mark}
                </p>
                <blockquote className="world-clan-conviction">
                  {c.conviction}
                  <cite>— {c.attribution}</cite>
                </blockquote>
              </article>
            ))}
          </div>
        </section>

        {/* ── The Four Templates (= the pieces) ────────────────── */}
        <section className="world-section world-section-alt">
          <h2 className="world-section-title">The four Aetheri templates</h2>
          <p className="world-section-lead">
            The Aetheri left four training-and-augmentation protocols —
            shared by both clans, named for the Aetheri who authored them.
            They are the game’s five pieces. The way each one moves on the
            board is the way its augmentation worked in the world.
          </p>
          <div className="world-templates">
            {TEMPLATES.map((t) => (
              <article key={t.name} className="world-template">
                <img
                  src={t.img}
                  alt={`${t.name} — ${t.role}.`}
                  className="world-template-img"
                  loading="lazy"
                />
                <div className="world-template-body">
                  <p className="world-template-role">{t.role}</p>
                  <h3 className="world-template-name">{t.name}</h3>
                  <p className="world-template-psych">{t.psych}</p>
                  <p className="world-template-line">
                    <span className="world-template-label">Augmentation</span>
                    {t.aug}
                  </p>
                  <p className="world-template-line">
                    <span className="world-template-label">On the board</span>
                    {t.game}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <p className="world-note">
            Five pieces a side, not four: the Soldier promotes. A{' '}
            <strong>Durren</strong> who crosses the full Terran depth under
            live opposition wakes the latent Dantec implant and becomes a{' '}
            <strong>Captain</strong>: a lawful claimant, able to capture
            the enemy's seals and answer the Nexus.
          </p>
        </section>

        {/* ── Seals, Lifts, the Nexus ──────────────────────────── */}
        <section className="world-section">
          <h2 className="world-section-title">The proof</h2>
          <div className="world-prose">
            <p>
              Each clan holds <strong>three claim-seals</strong>, one in a
              corner of each layer. A clan's Ground and Space seals sit on
              the same corner; its Sky seal sits at the diagonally opposite
              corner. The scholars call that alignment the{' '}
              <em>Aetheri Echo Point</em>: proof of continuity across the
              layers, not just reach. To win the long way, a Captain must
              capture all three of the enemy's seals, then stand on the
              Nexus.
            </p>
            <p>
              Between the layers run <strong>four Lifts</strong>, the
              hidden skeleton of the contest. Transit is never instant: a
              climber must reach a Lift, hold it, and rise on a later move,
              and a body standing in the column above can deny passage
              entirely, through presence alone. Every ascent is a claim
              about time, control, and vulnerability.
            </p>
          </div>
          <div className="world-figure-pair">
            <figure className="world-figure">
              <img
                src="/kaleo-council.jpg"
                alt="The Traverser High Council seated in a celestial chamber beneath a column of light."
                className="world-figure-img"
                loading="lazy"
              />
              <figcaption>The Traverser High Council.</figcaption>
            </figure>
            <figure className="world-figure">
              <img
                src="/kaleo-nexus.jpg"
                alt="A lone figure gazing up at the Caelum Nexus, a shaft of light at the summit of the arcology."
                className="world-figure-img"
                loading="lazy"
              />
              <figcaption>The Caelum Nexus, at Space (3,3).</figcaption>
            </figure>
          </div>
          <div className="world-prose">
            <p>
              At the summit waits the <strong>Caelum Nexus</strong>,
              silent and exacting: the one point on any layer claimed by
              neither clan. It does not reward haste, or bloodline, or mere
              survival. It answers the clan that proves continuity across
              all three layers of Kaleo. Only after a Captain has captured
              all three of the enemy's seals may that Captain approach.
            </p>
          </div>
          <blockquote className="world-pullquote">
            It does not feel like a judge. It feels like a listener whose
            attention is costly. The longer it listens, the more carefully
            one must speak.
            <cite>Renn Dantec, Grey Ravens, who chose not to ask</cite>
          </blockquote>
        </section>

        {/* ── The story + capture ──────────────────────────────── */}
        <section className="world-section world-section-alt">
          <h2 className="world-section-title">The story</h2>
          <p className="world-section-lead">
            <strong>Volume One — The Three Seals of Kaleo</strong> follows
            eight claimants through the First Reclamation: the campaign
            that became the game. The prequel, <em>Volume Zero</em>, reads
            free at the studio.
          </p>
          <div className="world-actions">
            <a href={READER_URL} className="world-cta">
              Read Volume Zero free →
            </a>
            <a href={RULEBOOK_URL} className="world-link" download>
              Download the rulebook (PDF) →
            </a>
          </div>
          <p className="world-section-lead">
            The physical edition launches on Kickstarter in Fall 2026 — be
            first in line for early-backer pricing.
          </p>
          <div className="world-actions">
            <a href="https://thresan.com/kickstarter" className="world-cta">
              Notify me at launch →
            </a>
          </div>
        </section>

        {/* ── Outbound ─────────────────────────────────────────── */}
        <div className="world-outbound">
          <a href={GAME_URL} className="world-link">
            Play Skyflag free →
          </a>
          <a href={STORE_URL} className="world-link">
            The physical edition (thresan.store) →
          </a>
          <a href={GAMES_URL} className="world-link">
            The editions (thresan.games) →
          </a>
          <a href={STUDIO_URL} className="world-link">
            The studio (thresan.studio) →
          </a>
          <a href={ORIGINS_URL} className="world-link">
            The origins of Skyflag →
          </a>
        </div>

        <p className="world-fineprint">
          Thresan™ is a project of Limnology Research Corp. ·{' '}
          <a href="https://playskyflag.com/privacy">Privacy</a> ·{' '}
          <a href="https://playskyflag.com/terms">Terms</a> ·{' '}
          <a href="https://playskyflag.com/ai-use">AI use</a>
        </p>
      </main>
    </div>
  );
}
