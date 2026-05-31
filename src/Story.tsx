// /story — The Three Seals of Kaleo, Volume One.
// A cinematic scroll-driven storybook drawn from the original
// Storybook v3 manuscript. Designed to be read, not skimmed.
//
// Visual approach: atmospheric typography on dark gold-on-black, with
// inline SVG accents for clan totems, layer geometry, and the Nexus.
// No external image assets required — everything renders from code.

import { useEffect } from 'react';
import './Story.css';
import { applySurfaceMeta } from './socialMeta';

export default function Story() {
  useEffect(() => {
    window.scrollTo(0, 0);
    return applySurfaceMeta({
      title: 'The Story — Thresan™: Skyflag',
      description:
        'Volume One of the Skyflag edition: the Three Seals of Kaleo. A narrative account of the campaign across Terran, Meridian, and Empyrean.',
      canonicalUrl: 'https://playskyflag.com/story',
      ogImage: 'https://playskyflag.com/thresan-og-clans.jpg',
      ogImageAlt: 'Three stacked boards with Grey Ravens and White Stags arrayed across all three planes.',
    });
  }, []);

  return (
    <div className="story">
      <StoryHeader />
      <Cover />
      <main className="story-main">
        <Foreword />
        <TwoClans />
        <FourTemplates />
        <Cast />
        <ChapterDivider title="The First Reclamation" subtitle="A narrative account of the campaign" />
        <Chapter1 />
        <Chapter2 />
        <Chapter3 />
        <Chapter4 />
        <Chapter5 />
        <Chapter6 />
        <Chapter7 />
        <Chapter8 />
        <Epilogue />
        <Closing />
      </main>
      <StoryFooter />
    </div>
  );
}

// ── Header & footer ─────────────────────────────────────────────────

function StoryHeader() {
  return (
    <header className="story-header">
      <div className="story-header-inner">
        <a href="/" className="story-back">← Skyflag</a>
        <div className="story-header-meta">Volume One</div>
        <a href="/play" className="story-cta-button">Play</a>
      </div>
    </header>
  );
}

function StoryFooter() {
  return (
    <footer className="story-footer">
      <div className="story-footer-inner">
        <p className="story-footer-mark">Thresan™: Skyflag — The Three Seals of Kaleo</p>
        <p className="story-footer-meta">
          Storybook v3 · © {new Date().getFullYear()} Limnology Research Corp.
        </p>
        <p className="story-footer-links">
          <a href="/">Home</a> · <a href="/play">Play</a> ·{' '}
          <a href="/origins">Origins</a> ·{' '}
          <a href="https://thresan.com">Universe</a> ·{' '}
          <a href="https://thresan.games">Editions</a> ·{' '}
          <a href="https://thresan.store">Edition</a> ·{' '}
          <a href="https://thresan.studio">Studio</a> ·{' '}
          <a href="https://thresan.io">Lab</a> ·{' '}
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> ·{' '}
          <a href="/ai-use">AI use</a>
        </p>
      </div>
    </footer>
  );
}

// ── Cover ───────────────────────────────────────────────────────────

function Cover() {
  return (
    <section className="story-cover">
      <div className="story-cover-glyph" aria-hidden="true">
        <ThreeLayersGlyph />
      </div>
      <p className="story-cover-eyebrow">Thresan™: Skyflag · Volume One</p>
      <h1 className="story-cover-title">The Three Seals<br />of Kaleo</h1>
      <p className="story-cover-subtitle">A story of the First Reclamation</p>
      <div className="story-cover-divider" aria-hidden="true">· · ·</div>
      <p className="story-cover-fineprint">
        A world suspended above a world that failed,
        <br />
        and a contest built into its law.
      </p>
    </section>
  );
}

// ── Foreword ────────────────────────────────────────────────────────

function Foreword() {
  return (
    <section className="story-section">
      <SectionTitle eyebrow="I" title="Kaleo" subtitle="A world above a world that failed" />
      <Prose>
        <p className="story-prose-lead">
          The Aetheri lifted what remained of civilization into a
          three-layer arcology when the planet below gave way to salt,
          dust, and ruined basins.
        </p>
        <p>
          The lowest layer, the <Term>Terran</Term>, holds the reservoirs,
          farms, workshops, and crowded human districts. Above it, the{' '}
          <Term>Meridian</Term> carries charged air, transit architecture,
          and the old routing systems. At the summit rests the{' '}
          <Term>Empyrean</Term> — the quiet upper shell where the Aetheri
          left their highest instruments.
        </p>
        <p>
          At the center of the Empyrean — and only there — waits the{' '}
          <Term>Caelum Nexus</Term>. The lower layers have no such central
          shrine. What they have, instead, are corners.
        </p>
        <p>
          Each clan keeps three claim-seals, set in the corners of its own
          territory, one on each layer. A clan's Terran seal and its
          Empyrean seal sit on the same corner; its Meridian seal sits at
          the diagonally opposite corner. The scholars call that alignment
          the <Term>Aetheri Echo Point</Term>: continuity across the
          layers, not reach alone, was the proof the Aetheri required.
        </p>
        <p>
          Only after a clan's Captain has captured all three of the enemy's
          seals may that Captain approach the Nexus and ask it to answer.
        </p>
        <p>
          The Aetheri did not trust survival to strength alone. They built
          Kaleo as a system of proofs.
        </p>
      </Prose>
    </section>
  );
}

// ── The Two Clans ───────────────────────────────────────────────────

function TwoClans() {
  return (
    <section className="story-section story-section-alt">
      <SectionTitle eyebrow="II" title="The Two Clans" subtitle="A schism six generations old" />
      <Prose>
        <p>
          For seven generations after founding, Kaleo was one people. The
          schism came in the eighth generation, during the event the
          archives record as the <Term>First Hollow</Term> — a partial
          outbreak of the wasting disease that would return six generations
          later as the Grey Hollow.
        </p>
        <p>
          The disagreement was about how to respond. One faction argued
          for immediate escalation. The other argued for containment. The
          containment faction won the argument by one vote. Their victory
          stabilized Kaleo at the cost of two hundred thousand Terran
          residents who might have been saved if the archives had been
          opened sooner. The escalation faction did not forget.
        </p>
      </Prose>

      <div className="story-clans-grid">
        <article className="story-clan story-clan-ravens">
          <div className="story-clan-totem" aria-hidden="true">
            <RavenGlyph />
          </div>
          <h3 className="story-clan-name">The Grey Ravens</h3>
          <p className="story-clan-tagline">
            Memory, custody, and the discipline of waiting.
          </p>
          <p className="story-clan-body">
            Slate-grey field uniforms with black accents. Long memory,
            high vantage. Ravens speak of <em>raven's patience</em> — the
            willingness to observe a situation for as long as observation
            alone can produce information, and to act only when action is
            the only remaining option.
          </p>
          <PullQuote attribution="— Grey Raven field maxim" muted>
            We have been here longer than the crisis. We will be here
            longer than its answer.
          </PullQuote>
        </article>

        <article className="story-clan story-clan-stags">
          <div className="story-clan-totem" aria-hidden="true">
            <StagGlyph />
          </div>
          <h3 className="story-clan-name">The White Stags</h3>
          <p className="story-clan-tagline">
            Traverse, urgency, and the legitimacy of reaching.
          </p>
          <p className="story-clan-body">
            Bone-ivory field uniforms with warm gold accents. Endurance
            across distance. Stags speak of the <em>stag-path</em> — the
            commitment to complete a traverse once begun, because a
            half-completed ascent is worse than an unattempted one.
          </p>
          <PullQuote attribution="— White Stag field maxim" muted>
            We were given a path. If we do not walk it, it becomes a
            monument to our refusal.
          </PullQuote>
        </article>
      </div>

      <Prose>
        <p className="story-prose-coda">
          Both clans claim duty. Both claim restraint. Both claim they are
          acting for Kaleo. Both are correct. Neither is complete.
        </p>
      </Prose>
    </section>
  );
}

// ── The Four Aetheri Templates ──────────────────────────────────────

function FourTemplates() {
  return (
    <section className="story-section">
      <SectionTitle eyebrow="III" title="The Four Aetheri Templates" subtitle="Shapes the people of Kaleo could pour themselves into" />
      <Prose>
        <p>
          The Aetheri did not leave Kaleo with armies. They left it with
          four training-and-augmentation protocols. A recruit who passes
          into one of the four templates inherits the name along with the
          training. The templates are shared across clans — the Ravens and
          the Stags both train their recruits into the same four
          protocols. What differs is only the cultural frame each clan
          wraps around the training.
        </p>
      </Prose>

      <div className="story-templates-grid">
        <Template
          name="DANTEC"
          role="Captain"
          description="The only piece that can capture the enemy's seals and answer the Nexus. Skullbase implant recognizes Aetheri seal authorization directly. A Dantec who captures a seal receives confirmation through the implant itself."
        />
        <Template
          name="DURREN"
          role="Soldier"
          description="The operative capable of sustained forward motion under conditions that would freeze a planner. Carries a latent Dantec implant designed to wake when the Durren completes a full-depth Terran traverse under live opposition."
        />
        <Template
          name="THANDIWE"
          role="Rover"
          description="Reads the arcology as a machine. Holds the Lift-occupancy state of all four columns across all three layers in working memory. Dominates corridors through presence, timing, and angle."
        />
        <Template
          name="VOSS"
          role="Pilot"
          description="Recognizes paths that exist because of angle and timing rather than physical corridor. Visual-cortex overlay projects sight-line geometries onto normal vision. Arrives one square sooner than the defender expected."
        />
      </div>

      <PullQuote attribution="— Archivist of the Third Generation">
        They did not make soldiers. They made the shapes we could pour
        ourselves into.
      </PullQuote>
    </section>
  );
}

function Template({
  name,
  role,
  description,
}: {
  name: string;
  role: string;
  description: string;
}) {
  return (
    <article className="story-template">
      <div className="story-template-name">{name}</div>
      <div className="story-template-role">{role}</div>
      <p className="story-template-body">{description}</p>
    </article>
  );
}

// ── The Eight Claimants ─────────────────────────────────────────────

function Cast() {
  return (
    <section className="story-section story-section-alt">
      <SectionTitle eyebrow="IV" title="The Eight Claimants" subtitle="Four Ravens, four Stags" />
      <Prose>
        <p>
          The current generation's contest is fought by four Ravens and
          four Stags. Their full roster follows.
        </p>
      </Prose>

      <div className="story-cast-clan">
        <h3 className="story-cast-clan-title">
          <RavenGlyph small /> The Grey Ravens
        </h3>
        <div className="story-cast-grid">
          <Character
            name="Renn Dantec"
            role="Captain · Grey Raven"
            bio="Fifties. Meridian-born, daughter of a Lift warden, raised in the shadow of the Raven Archive. The only character in the cast who has stood before the Nexus before — at twenty-nine, under a partial rediscovery, she declined to ask a question. The decision has defined her ever since."
            quote="The hardest answer is the one you can still defend tomorrow."
          />
          <Character
            name="Toren Durren"
            role="Soldier · Grey Raven"
            bio="Late twenties. Terran-born, raised in a Stag-adjacent reservoir sector — a fact that made his entry into the Raven clan a matter of quiet controversy. Discipline in service of urgency. Unusual in the Raven corps."
            quote="Hold the line. But hold it forward."
          />
          <Character
            name="Mox Thandiwe"
            role="Rover · Grey Raven"
            bio="Late thirties. Lift Warden quarter of the Meridian. His peripheral-vision augmentation is unusually broad-range. He has never personally killed an operative. He has made eleven operatives reroute into positions that cost their clan a campaign."
            quote="A route is never neutral. Someone designed it to help, slow, or stop you."
          />
          <Character
            name="Zara Voss"
            role="Pilot · Grey Raven"
            bio="Early thirties. Archive chemist turned field tactician. Treats capture-geometries the way an archivist treats cross-references — catalogued and collated rather than acted on immediately. Slower than most Vosses; her interventions, when they come, decisive."
            quote="Access changes the future long before possession does."
          />
        </div>
      </div>

      <div className="story-cast-clan">
        <h3 className="story-cast-clan-title">
          <StagGlyph small /> The White Stags
        </h3>
        <div className="story-cast-grid">
          <Character
            name="Sera Dantec"
            role="Captain · White Stag"
            bio="Mid-thirties. Terran-born, adopted by a Stag Ascendant family after her birth-parents died in a late aftershock of the First Hollow's lingering effects. Carries a quieter, more cautious Dantec temperament than the White Stag clan typically produces."
            quote="We were given a path. If we do not walk it, it becomes a monument to our refusal."
          />
          <Character
            name="Kael Durren"
            role="Soldier · White Stag"
            bio="Mid-thirties. Terran-born mining engineer, recruited into the Durren template late. His pressure-tolerance window is narrower, but his practical intelligence is broader. He keeps a notebook of the dead from his home sector."
            quote="Move before fear learns your name."
          />
          <Character
            name="Iva Thandiwe"
            role="Rover · White Stag"
            bio="Late thirties. Reservoir systems engineer before her Thandiwe template. Reads routes as pipework, not as transit. Iva and Mox have read each other's route-doctrine for nine years. They have never met in person."
            quote="A route serves the people who depend on it. Or it is not a route."
          />
          <Character
            name="Arin Voss"
            role="Pilot · White Stag"
            bio="Early thirties. Former Stag archive runner. Knows more of Kaleo's physical geography — service shafts, maintenance bypasses, closed corridors — than any operative in either clan. He can reach places the Voss template alone cannot."
            quote="Knowledge that cannot circulate begins to rot."
          />
        </div>
      </div>
    </section>
  );
}

function Character({
  name,
  role,
  bio,
  quote,
}: {
  name: string;
  role: string;
  bio: string;
  quote: string;
}) {
  return (
    <article className="story-character">
      <h4 className="story-character-name">{name}</h4>
      <div className="story-character-role">{role}</div>
      <p className="story-character-bio">{bio}</p>
      <p className="story-character-quote">&ldquo;{quote}&rdquo;</p>
    </article>
  );
}

// ── Chapter divider ─────────────────────────────────────────────────

function ChapterDivider({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section className="story-divider">
      <div className="story-divider-rule" aria-hidden="true">· · ·</div>
      <h2 className="story-divider-title">{title}</h2>
      {subtitle && <p className="story-divider-subtitle">{subtitle}</p>}
    </section>
  );
}

// ── Chapter 1 ───────────────────────────────────────────────────────

function Chapter1() {
  return (
    <Chapter num="One" title="Two Councils">
      <p className="story-prose-lead">
        The campaign the Houses of Kaleo would remember as the First
        Reclamation began quietly, in a Meridian sub-vault, three days
        before either clan had committed a Captain to the field.
      </p>
      <p>
        A Raven archivist had been looking for a condenser manifest that
        had been misfiled in the mid-Meridian archives for three
        generations. She had opened a binder no one living had opened.
        She had found, instead of the manifest, a folded leaf of pale
        parchment, small, half the size of a playing card. The leaf
        carried three phrases: <Term>TERRAN SEAL</Term>.{' '}
        <Term>MERIDIAN ECHO</Term>. <Term>EMPYREAN ECHO</Term>. Below
        them, in archaic Aetheri script:{' '}
        <Term>NO CLAIMANT MAY ANSWER WITHOUT CONTINUITY</Term>.
      </p>
      <p>
        She copied the leaf once. She took the copy to the Strategic
        Custodians. She did not send it anywhere else.
      </p>
      <Pause />
      <p>
        The Strategic Custodians of the Grey Ravens deliberated for
        seventy-two hours. They wanted to be certain that they had read
        the leaf correctly, that the Aetheri text was not forged, that
        the partial protocols they had been operating under for three
        generations were actually superseded. They deliberated. They
        voted. They authorized a campaign.
      </p>
      <p>
        Renn Dantec, senior Captain of the clan, was the natural choice.
        She had stood before the Nexus once in her life, twenty-two years
        earlier. The Custodians did not discuss with her whether she
        would ask this time. They did not need to. She was a Raven. They
        assumed the answer.
      </p>
      <p>
        Renn accepted the assignment. She did not tell the Custodians
        that she had already decided, before their vote, that she would
        not be the one to ask.
      </p>
      <Pause />
      <p>
        The White Stags learned of the discovery on day four. A Stag
        Medic, treating an unrelated respiratory condition in a Raven
        Archive Keeper, noticed an unusual distraction in her patient's
        bedside conversation — the archivist had been unable to stop
        returning to a phrase she recognized as Aetheri citation format.
        The information reached the Ascendant Council by evening.
      </p>
      <p>
        Where the Strategic Custodians had deliberated for seventy-two
        hours, the Ascendant Council authorized a campaign in twelve.
        Sera Dantec was already in the Stag Hall when the Council
        convened. She was in field uniform before they had finished
        speaking. She did not question the speed. It was characteristic
        Stag conduct.
      </p>
      <p>
        Thirty-six hours separated the two authorizations. By the time
        Renn was briefed on the campaign's structure, Sera had already
        deployed to the Terran.
      </p>
    </Chapter>
  );
}

// ── Chapter 2 ───────────────────────────────────────────────────────

function Chapter2() {
  return (
    <Chapter num="Two" title="The Ground Race">
      <p className="story-prose-lead">
        The Terran Seals of both clans lie in the lower architecture of
        the Ground layer, one at each clan's designated corner, close
        enough to the opening posture to invite impatience. That
        temptation is deliberate.
      </p>
      <p>
        Sera moved first. Her deployment position at Ground(0,3) placed
        her three activations from the Stag Terran Seal at Ground(0,0).
        She walked the processional corridor that led to the alcove with
        the measured pace of a Captain who has been through seal-wake
        drills for a decade. Her Dantec implant, dormant since her
        template's completion at twenty-four, sat at the base of her
        skull, waiting for its cue.
      </p>
      <p>
        When her palm met the leaping-stag crystal in the alcove, the cue
        arrived. The seal's warm gold light traced its own outline from
        within. At Sera's skullbase, a matching glow. The seal did not
        grant her power. It acknowledged her clan's claim, and registered
        the acknowledgment in the old Aetheri record.
      </p>
      <p className="story-prose-emphasis">
        One Stag seal awake. Two to go.
      </p>
      <Pause />
      <p>
        Renn moved second. Her deployment at Ground(5,2) and her Raven
        Terran Seal at Ground(5,5) were separated by collapsed
        architecture. She reached her seal two rounds later than Sera
        reached hers.
      </p>
      <p>
        The wake sequence was identical. Raven silver-grey light in the
        alcove. Renn's skullbase implant — older than Sera's, carrying
        more seal-wakes across more years — answering. Renn knelt beside
        the seal a moment longer than she needed to. Behind her, through
        a gap in the collapsed wall, a Terran ration yard was glimpsed at
        a distance. Civilians still in line. Still coughing.
      </p>
      <p>
        Raven doctrine did not reward velocity for its own sake, and a
        Captain who arrived at her first seal already fatigued was a
        Captain who would not reach her third.
      </p>
      <p className="story-prose-emphasis">
        Two seals awake across the Terran. Both clans, one-third proven.
      </p>
    </Chapter>
  );
}

// ── Chapter 3 ───────────────────────────────────────────────────────

function Chapter3() {
  return (
    <Chapter num="Three" title="The Lift War">
      <p className="story-prose-lead">
        The contest did not continue as a race after the first seals
        woke. It became a system war.
      </p>
      <p>
        Mox Thandiwe deployed to the Meridian on the fourth round. He did
        not move toward the Raven Meridian Echo. He moved toward a Stag
        Lift coordinate — Sky(1,4), the arrival point Sera would use when
        she ascended from the Terran. He did not run. He walked along the
        catwalk, past numbered Lift shafts, and stopped at the square
        platform marked with the corner symbol. He stepped onto it. He
        stood there. He did nothing else.
      </p>
      <p>
        The Aetheri engineers who designed the Lift system had built it
        to refuse movement into occupied space. A body at Sky(1,4) made
        the Lift corridor beneath it unusable. Mox did not need to fight.
        He needed only to stand where he needed to stand.
      </p>
      <p>
        Sera arrived at Lift (1,4) on the Terran. The control plate read
        MERIDIAN: OCCUPIED. She recognized the doctrine immediately —
        Raven, Mox, probably. She had read his field reports for nine
        years. She did not try to clear him. A Stag sent to clear a Raven
        Thandiwe on a Lift platform was a Stag the Stags could not afford
        to lose. Sera rerouted through Lift (4,1). Two activations lost.
      </p>
      <Pause />
      <p>
        Iva Thandiwe deployed to a Stag field station on the lower
        Meridian shortly after. She read the route-display the way a
        fluid-dynamics engineer reads pressure lines. Mox's Lift block
        was elegant, she thought, and morally corrupt. The Lift system
        existed to serve the people who depended on it. Blocking transit
        was sabotage.
      </p>
      <p>
        She did not try to clear Mox. Her Stag officer asked her whether
        to dispatch a clearance team. She refused. Mox would trade his
        life for Stag tempo; the Ravens would accept the trade; the Stags
        would pay more than they would save.
      </p>
      <p>
        Iva and Mox had read each other's route-doctrine for nine years.
        Neither had agreed with the other. Both had understood the other.
        In this campaign, they would contest the Lift network without
        ever meeting in person.
      </p>
    </Chapter>
  );
}

// ── Chapter 4 ───────────────────────────────────────────────────────

function Chapter4() {
  return (
    <Chapter num="Four" title="The Long Sky Crossing">
      <p className="story-prose-lead">
        Sera ascended to the Meridian through Lift (4,1) on the fifth
        round. She emerged from the transit cab into a layer unlike any
        she had walked before.
      </p>
      <p>
        The Meridian had not seen a Stag Captain in seven years. Her
        footsteps echoed in the wide corridors. The charged air moved
        against her face. The Stag Meridian Echo waited four king-moves
        away, at the top-right corner of the upper layer. Four king-moves
        of exposed transit. The Aetheri had designed the Meridian
        crossing to be the hardest proof of the Law of Three.
      </p>
      <p>
        Zara Voss deployed to intercept her.
      </p>
      <p>
        Zara was the first Voss in either clan's field that campaign. Her
        archive-chemist's training had taught her to treat
        capture-geometries as cross-references, to be catalogued before
        they were acted on. She did not chase Sera across the Meridian.
        She arrived at one specific coordinate, fifteen meters ahead of
        Sera's projected path, and she stood there.
      </p>
      <p>
        Sera saw her. The two women faced each other across open Meridian
        floor. Neither drew a weapon. Neither needed to.
      </p>
      <PullQuote>
        You rerouted around Mox. You did not plan for me.
      </PullQuote>
      <p>
        Sera had options. She could engage Zara directly — a Dantec's
        king-move had capture-geometry sufficient to threaten a Voss in
        adjacent space. She could try to cross diagonally and outflank —
        a move Zara's augmentation was specifically designed to prevent.
        Or she could step sideways, one square, and evade Zara's
        sight-line rather than fight through it.
      </p>
      <p>
        She stepped sideways. A lateral king-move. Not forward, not
        diagonal, but across. Zara's expression as the move registered
        was not frustration. It was recognition.
      </p>
      <p>
        The Meridian stripped rhetoric away. By the time Sera reached the
        Stag Meridian Echo — seven activations after her Lift arrival
        rather than the planned four — she had been grazed twice by
        Zara's positioning, had lost a support operative she had not
        expected to lose, and had arrived at the seal tired in a way she
        had not been on the Terran.
      </p>
      <p className="story-prose-emphasis">
        She placed her hand on the leaping-stag crystal. Two Stag seals
        awake. The chain was two-thirds complete.
      </p>
    </Chapter>
  );
}

// ── Chapter 5 ───────────────────────────────────────────────────────

function Chapter5() {
  return (
    <Chapter num="Five" title="Toren's Question">
      <p className="story-prose-lead">
        In the Raven field command post on the Meridian, Toren Durren had
        been listening for two rounds.
      </p>
      <p>
        The route-holo display showed the campaign state: Sera on the
        Meridian, Kael deep in the Terran, Zara advancing, Mox still
        holding his block. Renn stood at the display with her senior
        staff, reading the positions. Toren waited at the edge of the
        command post, in field uniform, ready to deploy if the Captain
        chose to deploy him. She had not.
      </p>
      <p>
        He turned to his Captain. He had known since the campaign's
        opening that he would ask this question.
      </p>
      <PullQuote>
        If they can do it, why can't we?
      </PullQuote>
      <p>
        Renn did not rush her answer. She had been answering this
        question in her own head for thirty years. Every Durren carried
        the latent Dantec, she told him. Every Durren who completed the
        row-five traverse under live opposition would be waked.
      </p>
      <p>
        But the protocol had a failure rate. Twelve Durrens had attempted
        the crossing in recorded history. Seven had survived to row five.
        Of those seven, four had been waked successfully. Three had been
        waked and had collapsed within one round of the implant's
        activation. The Stag clan considered a fifty-seven percent
        success rate acceptable. The Ravens did not.
      </p>
      <PullQuote attribution="— Renn Dantec">
        Because we will still be here when their waked Durren collapses
        at the wrong moment. We will not be here if ours does.
      </PullQuote>
      <p>
        Toren processed the numbers. Fifty-seven percent was better than
        zero. Renn did not disagree. Zero was what the Ravens chose. The
        distance between the two clans was the distance between
        fifty-seven and zero, and it was not a disagreement over
        arithmetic. It was a disagreement over which kind of clan the
        speaker wanted Kaleo to have when this campaign ended.
      </p>
      <p>
        Toren said the only other thing that was true. The Grey Hollow
        was killing one in three in Sector Seven. Kael Durren, the Stag
        Durren currently at row four of the Terran, had kept a notebook
        of those names because someone had to.
      </p>
      <p className="story-prose-emphasis">And we wait.</p>
      <p>
        Renn did not disagree with him on this point either. She said
        only: <em>we wait</em>.
      </p>
      <p>
        Toren accepted the order. He did not agree. His last word to his
        Captain was <em>Yes, Captain</em>, and the word carried both
        obedience and the reservation that obedience could not erase.
      </p>
    </Chapter>
  );
}

// ── Chapter 6 ───────────────────────────────────────────────────────

function Chapter6() {
  return (
    <Chapter num="Six" title="The Template-Wake">
      <p className="story-prose-lead">
        Kael Durren reached row five of the Terran on the same round Sera
        Dantec reached the Meridian Echo.
      </p>
      <p>
        He had spent four activations crossing the Terran under live
        opposition. He had been threatened twice. He had been forced into
        a corridor he had not planned to use. He had arrived at the
        terminal row tired, sore, and aware that every Durren who had
        attempted this crossing in recorded history had died at row two.
      </p>
      <p>
        He reached the boundary. He stopped walking.
      </p>
      <p className="story-prose-emphasis">
        The wake took four seconds.
      </p>
      <p>
        A warmth at the base of his skull that was not painful, only
        warmer than the rest of him. A sudden doubling of his visual field
        as the Dantec overlay activated — capture-geometries, movement
        options, seal-acknowledgements he had been trained to recognize
        in others for ten years, now his own. A hairline of gold light
        traced the Stag sigil on his sleeve from within; the leaping stag
        that had marked him as a Durren was now becoming the mark of a
        Captain.
      </p>
      <p>
        Kael was, for four seconds, both things at once. A Durren who had
        completed a traverse. A Dantec who had just been raised to the
        mantle. Then the wake settled. His route map, unfolded in his
        hand, had acquired new options — a Dantec's king-move range, all
        eight directions, all three layers available to him now.
      </p>
      <p>
        The Stag clan possessed two claimants where it had possessed one.
      </p>
      <Pause />
      <p>
        In the Raven field command post, two layers above, a route
        operator watched his holo display resolve the second Stag Dantec
        icon. He reported it to Renn. Renn, still at the display with
        Toren beside her, did not let Toren speak. She said one word:{' '}
        <em>Don't</em>.
      </p>
      <p>
        Toren did not speak. He watched her face instead. He understood,
        for the first time, the thirty-year silence his Captain had been
        carrying. She had just declined, in a single syllable, to give
        her own Durren the same chance the Stags had given theirs. She
        had been willing to let Kael succeed — she had known he might.
        She was not willing to take the same risk with Toren.
      </p>
      <p>
        Toren said nothing. He stood at the wall of the command post for
        another twenty minutes, watching the holo, until Renn dismissed
        him.
      </p>
    </Chapter>
  );
}

// ── Chapter 7 ───────────────────────────────────────────────────────

function Chapter7() {
  return (
    <Chapter num="Seven" title="The Empyrean Echo">
      <p className="story-prose-lead">
        Both Captains ascended to the Empyrean in the following rounds.
      </p>
      <p>
        Sera reached the upper layer first. Mox had redeployed from
        Sky(1,4) to block Kael's projected Meridian Lift at (4,4),
        freeing Sera's original Lift. She ascended through (1,4) into the
        Empyrean — bone-white floor plates, weightless architecture, the
        Nexus a held-breath glow at the dead center of the grid. She had
        never walked the Empyrean. No living Stag Dantec had.
      </p>
      <p>
        Zara was waiting for her.
      </p>
      <p>
        Zara had ascended to the Empyrean on the previous cycle. She had
        positioned herself not at the Stag Empyrean Echo, but one square
        from it — a Voss positioned to threaten Sera's next move. Sera
        could take the seal. Sera would then be unable to move. Zara
        could capture her on the following activation.
      </p>
      <p>
        Sera recognized the trade. She made the calculation. She was
        willing.
      </p>
      <p className="story-prose-emphasis">
        She took the seal.
      </p>
      <p>
        Her palm against the leaping-stag crystal at Space(0,5). Gold
        light from within. The third Stag seal awake. The chain complete.
        Sera still standing.
      </p>
      <p>
        Zara took her diagonal Voss move. Two squares, ending adjacent to
        Sera. The capture was clean, professional, almost respectful.
        Zara did not smile. Sera said only: <em>Don't be sorry</em>. She
        fell. The seal continued to burn independent of her.
      </p>
      <p>
        The Law of Three does not require a living claimant at the moment
        of answer. It requires only that the chain have been completed,
        and that a lawful Dantec remain. Kael was now the only Stag
        Dantec on the board.
      </p>
      <Pause />
      <p>
        Renn reached her own Empyrean Echo three activations later. The
        Raven approach was slower by necessity — her Lift path from the
        Meridian had been contested by a Stag Reservoir Corps operative,
        and she had taken a circuitous route to avoid exposure.
      </p>
      <p>
        Her palm met the Raven crystal at Space(5,0). Silver-grey light
        from within. The third Raven seal awake. The Raven chain
        complete.
      </p>
      <p className="story-prose-emphasis">
        Both clans had now proven continuity.
      </p>
    </Chapter>
  );
}

// ── Chapter 8 ───────────────────────────────────────────────────────

function Chapter8() {
  return (
    <Chapter num="Eight" title="The Answering Place">
      <div className="story-nexus-glyph" aria-hidden="true">
        <NexusGlyph />
      </div>
      <p className="story-prose-lead">
        Kael and Renn arrived at the base of the Nexus on the same
        activation.
      </p>
      <p>
        Neither was closer. The Aetheri had designed the Answering Place
        to accept claimants equally: two circles were engraved into the
        floor at the base of the crystalline spire, one for each clan.
        Aetheri text resolved on the plinth as the two Captains entered
        their circles.
      </p>
      <PullQuote>
        TWO LAWFUL CLAIMANTS. ONE ANSWER PERMITTED.
        <br />
        FIRST CHAIN: GREY RAVEN.
        <br />
        THE RAVEN WILL SPEAK FIRST.
      </PullQuote>
      <p>
        Renn's chain had completed three rounds before Sera's. That was
        the tiebreak. Under Aetheri law, Renn had precedence.
      </p>
      <p>
        The two Dantecs looked at each other for the first time in either
        of their lives. Renn was fifty-one. She was weathered,
        silver-streaked, the black flight-feather at her collar stirring
        in a current of Empyrean air. Kael was mid-thirties, a mining
        engineer six hours into a Dantec mantle. They had never met.
      </p>
      <p>
        Kael said: <em>You're her. The one who didn't ask.</em>
      </p>
      <p>
        Renn said: <em>Yes.</em>
      </p>
      <p>
        They both looked up at the Nexus. The inscription held. Renn had
        precedence. The Nexus was waiting for her question.
      </p>
      <Pause />
      <p>
        She turned from the Nexus to face Kael directly. What she did
        next was, by Raven doctrine, forbidden. The precedence was not
        hers to give away.
      </p>
      <p>
        She asked him what he would ask for.
      </p>
      <p>
        Kael processed the question. He was a Durren six hours ago. A man
        who kept a notebook of the dead from Sector Seven. This was the
        question he was born to answer and he had not known it.
      </p>
      <p>
        He told her: the Grey Hollow. The list of names. The reason the
        list existed.
      </p>
      <p>
        Renn told him she had the same lists, in Sector Four and Sector
        Eleven, and that the Raven Archive Keepers did not show those
        lists to the Strategic Custodians. The two Captains were the only
        people in either clan's command structure who had seen both
        lists.
      </p>
      <PullQuote attribution="— Renn Dantec">
        I could ask for it myself. I didn't, twenty-two years ago, because
        I didn't know how to ask correctly. You are a Durren three hours
        into a Dantec mantle. You are the only person here who can still
        ask a question without already knowing the answer.
      </PullQuote>
      <p>
        Kael warned her. The Ascendants will not accept this. Renn said:
        No. Neither will the Custodians. We will both pay for this. You
        more than me.
      </p>
      <p>
        He asked anyway.
      </p>
      <PullQuote large attribution="— Kael Dantec, at the Caelum Nexus">
        Open the Aetheri archives of Kaleo to both clans and to the
        civilian population. Release the medical protocols sealed in
        them. Let the cure circulate.
      </PullQuote>
      <p className="story-prose-emphasis">
        The Nexus answered.
      </p>
    </Chapter>
  );
}

// ── Epilogue ────────────────────────────────────────────────────────

function Epilogue() {
  return (
    <Chapter num="Nine" title="The Cost of Legitimacy">
      <p>
        The archives do not record what else was said at the Answering
        Place. They record only what happened after.
      </p>
      <p>
        The Grey Hollow was, within a season, reduced to a quarter of its
        previous rate. The condenser systems were stabilized. Three of
        the failing reservoirs were rebuilt with Aetheri protocols that
        had not been available to any engineer in Kaleo's living memory.
        The medical protocols sealed in the archives were opened — not to
        one clan, but to both, and to civilian distribution.
      </p>
      <p>
        The cost was also specific. Water rationing did not loosen; it
        tightened. The condensers had been restored to full capacity, but
        the allocation protocols the Nexus imposed as a condition of its
        answer were stricter than anything the Grey Ravens had ever
        proposed.
      </p>
      <p>
        A system had been saved. A politics had been closed. The Nexus
        understood itself. It knew what its answer would cost. It gave
        the cost along with the cure.
      </p>
      <Pause />
      <p>
        Sera Dantec was recovered from the Empyrean three days after the
        answer. Her body was returned to the White Stag clan under a
        civic-neutrality protocol both clans honored. Her death was
        recorded in both clans' archives with equal honor.
      </p>
      <p>
        Kael kept the Dantec mantle. He did not volunteer for it. The
        Stag clan added a senior Dantec's antler fragment to his
        shoulder. He wore it in formal settings. He did not wear it
        often.
      </p>
      <p>
        Renn Dantec returned to the Meridian. She faced the Strategic
        Custodians. Their judgment was specific. Renn was within Aetheri
        law. She had been outside Raven doctrine. She was simply marked:
        she would not stand before the Nexus under Raven sanction again.
        She accepted the notation without objection. She had not expected
        anything else.
      </p>
      <Pause />
      <p>
        Kael Durren returned to the Terran. He went, on the day after the
        Ascendant Council's formal recognition of his mantle, back to the
        ration yard in Sector Seven. He stood in civilian clothes with
        the crowd and watched the line move. He took his pocket notebook
        out and added one name to the list.
      </p>
      <p className="story-prose-emphasis">
        SERA DANTEC.
      </p>
      <p>
        He closed the notebook. He put it in his coat. He looked up at
        the Meridian architecture visible through a Terran skylight, and
        beyond that at the faint line of the Empyrean, and beyond that at
        the Nexus he could not see from where he stood.
      </p>
      <p>
        He said, quietly: <em>The hardest answer is the one you can still
        defend tomorrow.</em>
      </p>
      <p>
        It was not his motto. He had borrowed it from a Raven Captain who
        had borrowed it from an older Dantec still. The Dantec mantle, it
        seemed, carried the words forward.
      </p>
    </Chapter>
  );
}

// ── Closing ─────────────────────────────────────────────────────────

function Closing() {
  return (
    <section className="story-closing">
      <div className="story-closing-divider" aria-hidden="true">· · ·</div>
      <p className="story-closing-prose">
        Every modern campaign re-stages the First Reclamation. No two
        campaigns are identical, because no two clans field the same
        operatives in the same order, and because the Law of Three rewards
        adaptation over preparation.
      </p>
      <p className="story-closing-prose">
        Kaleo is not a civilization that can be saved by strength. It is
        a civilization that has been bound, by the Aetheri themselves, to
        prove its own legitimacy before it is permitted to save itself.
      </p>
      <PullQuote large>
        The Aetheri did not build three layers.
        <br />
        They built three answers to the same question.
      </PullQuote>
      <div className="story-closing-cta">
        <a href="/play" className="story-cta-button story-cta-large">
          Play
        </a>
      </div>
    </section>
  );
}

// ── Helper components ───────────────────────────────────────────────

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="story-section-header">
      {eyebrow && <div className="story-section-eyebrow">{eyebrow}</div>}
      <h2 className="story-section-title">{title}</h2>
      {subtitle && <p className="story-section-subtitle">{subtitle}</p>}
    </header>
  );
}

function Chapter({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="story-chapter">
      <header className="story-chapter-header">
        <div className="story-chapter-num">Chapter {num}</div>
        <h2 className="story-chapter-title">{title}</h2>
      </header>
      <div className="story-chapter-body">{children}</div>
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="story-prose">{children}</div>;
}

function Term({ children }: { children: React.ReactNode }) {
  return <span className="story-term">{children}</span>;
}

function Pause() {
  return <div className="story-pause" aria-hidden="true">· · ·</div>;
}

function PullQuote({
  children,
  attribution,
  large,
  muted,
}: {
  children: React.ReactNode;
  attribution?: string;
  large?: boolean;
  muted?: boolean;
}) {
  const cls = [
    'story-pullquote',
    large ? 'story-pullquote-large' : '',
    muted ? 'story-pullquote-muted' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <blockquote className={cls}>
      <p>{children}</p>
      {attribution && <cite>{attribution}</cite>}
    </blockquote>
  );
}

// ── Inline SVG glyphs ───────────────────────────────────────────────

function ThreeLayersGlyph() {
  return (
    <svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="6" width="200" height="6" rx="2" fill="#3e5878" opacity="0.85" />
      <rect x="0" y="36" width="200" height="6" rx="2" fill="#6585a8" opacity="0.85" />
      <rect x="0" y="66" width="200" height="6" rx="2" fill="#9c7a55" opacity="0.85" />
      <circle cx="100" cy="9" r="3.5" fill="#C2A46B" />
    </svg>
  );
}

function RavenGlyph({ small }: { small?: boolean } = {}) {
  const size = small ? 24 : 64;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M 12 32 Q 20 14 36 18 Q 50 22 54 32 L 50 32 L 46 28 L 40 32 Q 36 36 32 34 L 28 38 L 22 36 L 14 38 Z"
        fill="#7a8aa0"
        opacity="0.9"
      />
      <circle cx="40" cy="22" r="1.5" fill="#0a0e16" />
      <line x1="0" y1="46" x2="64" y2="46" stroke="#7a8aa0" strokeWidth="1" opacity="0.4" />
      <line x1="0" y1="52" x2="64" y2="52" stroke="#7a8aa0" strokeWidth="1" opacity="0.4" />
      <line x1="0" y1="58" x2="64" y2="58" stroke="#7a8aa0" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function StagGlyph({ small }: { small?: boolean } = {}) {
  const size = small ? 24 : 64;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M 22 8 L 18 4 M 22 8 L 26 4 M 26 8 L 22 4 M 38 8 L 42 4 M 38 8 L 34 4 M 42 8 L 38 4"
        stroke="#f5e8c0"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M 32 12 Q 36 14 36 22 Q 38 26 36 32 L 34 36 L 36 44 L 32 50 L 28 44 L 30 36 L 28 32 Q 26 26 28 22 Q 28 14 32 12 Z"
        fill="#f5e8c0"
        opacity="0.9"
      />
      <circle cx="46" cy="20" r="2" fill="#C2A46B" opacity="0.7" />
      <line x1="0" y1="56" x2="64" y2="56" stroke="#f5e8c0" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function NexusGlyph() {
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="nexus-glow">
          <stop offset="0%" stopColor="#C2A46B" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#C2A46B" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#C2A46B" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="55" fill="url(#nexus-glow)" />
      <path
        d="M 60 20 L 70 60 L 60 100 L 50 60 Z"
        fill="#C2A46B"
        opacity="0.85"
      />
      <path
        d="M 20 60 L 60 50 L 100 60 L 60 70 Z"
        fill="#C2A46B"
        opacity="0.85"
      />
      <circle cx="60" cy="60" r="5" fill="#fff8e0" />
    </svg>
  );
}
