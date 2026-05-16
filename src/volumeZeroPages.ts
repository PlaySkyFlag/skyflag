// Volume Zero — page manifest. The reader (VolumeZeroReader.tsx) and the
// landing (VolumeZeroLanding.tsx) read from this single source of truth.
// The comic art does not exist yet; this ships as an empty manifest so
// the reader/landing render an honest "in production" state today and
// light up the moment pages are dropped in — no component changes.
//
// ── Naming reconciliation (READ THIS) ──────────────────────────────
// The public/marketing title is "Thresan: Skyflag — Volume Zero: The
// Eight-Footed Mark" (latest creator direction: it's a prequel).
// The ISBN 978-1-7388485-4-6 was registered against the title
// "Thresan: Skyflag, Issue One: The Eight-Footed Mark". registeredTitle
// keeps the registry-truthful string; do NOT change it to match the
// display title — the ISBN record is external. The colophon shows the
// registered title so the printed/ISBN record and the page agree.
// Open question for Nelson: keep ISBN as "Issue One" with a note, or
// re-register/amend with LAC to "Volume Zero". Until decided, both
// strings are carried separately and truthfully.
//
// ── Art deliverables ───────────────────────────────────────────────
// Web-reader pages go in public/volume-zero/ named per the export
// convention: TH_VolumeZero_00_Cover, TH_VolumeZero_01 … TH_VolumeZero_16,
// TH_VolumeZero_17_BackCover (see docs/volume-zero/deliverables.md).
// Add an entry per page below in reading order once cleared for
// release. Art direction is cinematic, page-based, dark-fantasy /
// industrial sci-fi — NOT vertical-scroll webtoon.

export type VolumeZeroPageKind = 'cover' | 'page' | 'backmatter' | 'backcover';

export type VolumeZeroPage = {
  /** Public path, e.g. "/volume-zero/TH_VolumeZero_01.jpg". */
  src: string;
  /** Accessible description for screen readers / failed image load. */
  alt: string;
  /** Drives chrome: cover/back render without a "page N" counter. */
  kind: VolumeZeroPageKind;
};

/**
 * Pages in reading order — cover first, back cover last. Empty until
 * the first pages are cleared for release. Shape (uncomment when art
 * exists; the prequel is framed as 16 interior pages):
 *
 *   { src: '/volume-zero/TH_VolumeZero_00_Cover.jpg', alt: 'Cover — the Eight-Footed Mark.', kind: 'cover' },
 *   { src: '/volume-zero/TH_VolumeZero_01.jpg',       alt: 'Page 1 — the Lifts go quiet.',   kind: 'page' },
 *   …
 *   { src: '/volume-zero/TH_VolumeZero_16_Backmatter.jpg', alt: 'Backmatter — play Skyflag, join the Kickstarter list.', kind: 'backmatter' },
 *   { src: '/volume-zero/TH_VolumeZero_17_BackCover.jpg',  alt: 'Back cover.', kind: 'backcover' },
 */
export const VOLUME_ZERO_PAGES: VolumeZeroPage[] = [];

/** Cover image for the landing hero, or null until it exists. */
export const VOLUME_ZERO_COVER: string | null = null;

/** Downloadable digital PDF (02_PDF_Digital), or null until it exists. */
export const VOLUME_ZERO_PDF: string | null = null;

/**
 * ISBN-13, registry-truthful. Assigned 2026-05-15 by the publisher
 * (Limnology Research Corp.) for the Mixed media product format,
 * registered against registeredTitle. Check digit verified. Never
 * fabricate or alter.
 */
export const VOLUME_ZERO_ISBN: string | null = '978-1-7388485-4-6';

/**
 * Gates "publication-ready" framing. Stays false until the readable
 * pages exist — an assigned ISBN registers the work but does not make
 * it readable. Flip when pages land.
 */
export const VOLUME_ZERO_PUBLICATION_READY = false;

/** Issue framing — single source for every surface. */
export const VOLUME_ZERO = {
  seriesTitle: 'Thresan: Skyflag',
  /** Public display title. */
  title: 'Thresan: Skyflag — Volume Zero: The Eight-Footed Mark',
  /** Short form for cards/headers. */
  shortTitle: 'Volume Zero: The Eight-Footed Mark',
  /** Exactly as registered against the ISBN — do not edit to match display. */
  registeredTitle: 'Thresan: Skyflag, Issue One: The Eight-Footed Mark',
  subtitle: 'A 16-page graphic prequel to the Skyflag strategy game.',
  author: 'Dr. Nelson Jatel',
  publisher: 'Limnology Research Corp.',
  imprint: 'Thresan.studio',
  format: 'Mixed media product',
  copyrightYear: 2026,
  tagline: 'Three worlds. One proof.',
  synopsis:
    'Before the clans had names, the Aetheri lifted three arcologies ' +
    'off the Earth and the Lifts went quiet. Volume Zero is the world ' +
    'of Kaleo at that hinge — the Grey Ravens, the White Stags, and ' +
    'the Caelum Nexus they both reach for. It is the prequel to the ' +
    'current edition of Thresan: Skyflag.',
} as const;

/** Copyright line for colophons. */
export const VOLUME_ZERO_COPYRIGHT =
  `© ${VOLUME_ZERO.copyrightYear} ${VOLUME_ZERO.publisher}. ` +
  `Thresan™ and Skyflag™ are trademarks of ${VOLUME_ZERO.publisher}. ` +
  `All rights reserved.`;
