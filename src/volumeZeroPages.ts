// Issue One — page manifest. The reader (VolumeZeroReader.tsx) and the
// landing (VolumeZeroLanding.tsx) read from this single source of truth.
// Populated 2026-05-15 from the first publication-edition PDF (rendered
// to 2000×3000 JPGs in public/volume-zero/). To revise: re-render and
// update the entries below — no component changes needed.
//
// ── Naming (RESOLVED 2026-05-15) ───────────────────────────────────
// Decision: the public/display title is aligned to the ISBN-registered
// title — "Thresan: Skyflag, Issue One: The Eight-Footed Mark". The
// site and the ISBN record now read identically; no Library and
// Archives Canada amendment is needed. `title` therefore equals
// `registeredTitle` verbatim. The "volume-zero" string survives ONLY as
// internal infra — the route slug (/volume-zero, alias
// /the-eight-footed-mark), the module/identifier names (VOLUME_ZERO),
// the public asset dir (public/volume-zero/), the export filename
// convention (TH_VolumeZero_*), and docs/volume-zero/. None of those
// are user-facing title text, so they intentionally stay put.
//
// ── Art deliverables ───────────────────────────────────────────────
// Web-reader pages go in public/volume-zero/ named per the export
// convention: TH_VolumeZero_00_Cover, TH_VolumeZero_01 … TH_VolumeZero_16,
// TH_VolumeZero_17_BackCover (see docs/volume-zero/deliverables.md).
// Add an entry per page below in reading order once cleared for
// release. Art direction is cinematic, page-based, dark-fantasy /
// industrial sci-fi — NOT vertical-scroll webtoon.

export type VolumeZeroPageKind =
  | 'cover'
  | 'frontmatter'
  | 'page'
  | 'backmatter'
  | 'backcover';

export type VolumeZeroPage = {
  /** Public path, e.g. "/volume-zero/TH_VolumeZero_01.jpg". */
  src: string;
  /** Accessible description for screen readers / failed image load. */
  alt: string;
  /** Drives chrome: cover/back render without a "page N" counter. */
  kind: VolumeZeroPageKind;
};

/**
 * Pages in reading order, rendered from the publication PDF
 * (8 leaves: cover, credits/indicia, 5 story pages, back cover) at
 * 2000×3000. Story pages are the only `kind: 'page'` entries so the
 * reader numbers them 1–5; cover/credits/back render label-only.
 */
export const VOLUME_ZERO_PAGES: VolumeZeroPage[] = [
  {
    src: '/volume-zero/TH_VolumeZero_00_Cover.jpg',
    alt: 'Cover — Thresan: Skyflag, Issue One: The Eight-Footed Mark. Renn Dantec of the Grey Ravens and Sera Dantec of the White Stags stand before the stone guardian, the Aetheri leaf glowing between them.',
    kind: 'cover',
  },
  {
    src: '/volume-zero/TH_VolumeZero_00b_Credits.jpg',
    alt: 'Credits and indicia — created and written by Dr. Nelson Jatel, published by Limnology Research Corp., AI-assisted creation disclosure, and ISBN 978-1-7388485-4-6.',
    kind: 'frontmatter',
  },
  {
    src: '/volume-zero/TH_VolumeZero_01.jpg',
    alt: 'Renn searches the Second Epoch archives; the eight-footed mark wakes, glowing, in her hand.',
    kind: 'page',
  },
  {
    src: '/volume-zero/TH_VolumeZero_02.jpg',
    alt: 'Sera at the White Stags holo-table — the mark is confirmed. "Renn found it. Sound the mobilization."',
    kind: 'page',
  },
  {
    src: '/volume-zero/TH_VolumeZero_03.jpg',
    alt: 'Blood on the floor-glyph wakes the stone guardian. "It recognizes the blood. For the Legacy."',
    kind: 'page',
  },
  {
    src: '/volume-zero/TH_VolumeZero_04.jpg',
    alt: 'The gate opens; the guardian lets Renn and Sera pass. Something beneath the core was not sleeping.',
    kind: 'page',
  },
  {
    src: '/volume-zero/TH_VolumeZero_05.jpg',
    alt: 'The Caelum Nexus burns. "The eight-footed mark was never a game. It was a warning." Next: Issue Two — The Violet Beneath.',
    kind: 'page',
  },
  {
    src: '/volume-zero/TH_VolumeZero_06_BackCover.jpg',
    alt: 'Back cover — synopsis, ISBN barcode, and the Issue Two teaser, The Violet Beneath.',
    kind: 'backcover',
  },
];

/** Cover image for the landing hero. */
export const VOLUME_ZERO_COVER: string | null =
  '/volume-zero/TH_VolumeZero_00_Cover.jpg';

/** Downloadable digital PDF (02_PDF_Digital). */
export const VOLUME_ZERO_PDF: string | null = '/volume-zero/issue-one.pdf';

/**
 * ISBN-13, registry-truthful. Assigned 2026-05-15 by the publisher
 * (Limnology Research Corp.) for the Mixed media product format,
 * registered against registeredTitle. Check digit verified. Never
 * fabricate or alter.
 */
export const VOLUME_ZERO_ISBN: string | null = '978-1-7388485-4-6';

/**
 * Gates "publication-ready" framing. True as of 2026-05-15: the full
 * publication PDF (cover, indicia, 5 story pages, back cover, ISBN,
 * creator AI disclosure) is rendered into the reader — this is the
 * first publication edition, not a placeholder.
 */
export const VOLUME_ZERO_PUBLICATION_READY = true;

/** Issue framing — single source for every surface. */
export const VOLUME_ZERO = {
  seriesTitle: 'Thresan: Skyflag',
  /** Public display title — aligned verbatim to the ISBN registration. */
  title: 'Thresan: Skyflag, Issue One: The Eight-Footed Mark',
  /** Short form for cards/headers. */
  shortTitle: 'Issue One: The Eight-Footed Mark',
  /** As registered against the ISBN — now identical to `title`. */
  registeredTitle: 'Thresan: Skyflag, Issue One: The Eight-Footed Mark',
  subtitle: 'A graphic prequel to the Thresan strategy game.',
  author: 'Dr. Nelson Jatel',
  publisher: 'Limnology Research Corp.',
  imprint: 'Thresan.studio',
  format: 'Mixed media product',
  copyrightYear: 2026,
  tagline: 'Three worlds. One proof.',
  synopsis:
    'Before the clans had names, the Aetheri lifted three arcologies ' +
    'off the Earth and the Lifts went quiet. Issue One is the world ' +
    'of Kaleo at that hinge — the Grey Ravens, the White Stags, and ' +
    'the Caelum Nexus they both reach for. It is the prequel to the ' +
    'current edition of Thresan: Skyflag.',
} as const;

/** Copyright line for colophons. */
export const VOLUME_ZERO_COPYRIGHT =
  `© ${VOLUME_ZERO.copyrightYear} ${VOLUME_ZERO.publisher}. ` +
  `Thresan™ and Skyflag™ are trademarks of ${VOLUME_ZERO.publisher}. ` +
  `All rights reserved.`;
