#!/usr/bin/env node
// QAQC: render invariants — guards visual-rendering regressions that the
// HTTP/route smoke test can't see.
//
// Invariant 1 — piece glyphs must render as TEXT, not color emoji.
//   Added after the 2026-06-05 "white Soldier renders black" bug. iOS/
//   WebKit gives some chess characters (notably the pawn ♟ U+265F) an
//   EMOJI presentation that ignores SVG `fill`, so the white (p1) pieces
//   appear black. Board.tsx fixes this by appending the U+FE0E text
//   variation selector to every piece glyph at render. This check derives
//   the glyph list from App.tsx's PIECE_SYMBOL map (so a NEW piece glyph
//   that isn't guarded also fails) and asserts the fix is still in place.
//
// Run: `npm run check:render` (also runs in the route-smoke CI workflow).

import { readFileSync } from 'node:fs';

const fail = [];
const app = readFileSync('src/App.tsx', 'utf8');
const board = readFileSync('src/Board.tsx', 'utf8');

// 1) Glyphs the app actually draws for pieces (values of PIECE_SYMBOL).
const symBlock = app.match(/PIECE_SYMBOL[^{]*\{([\s\S]*?)\}/);
let glyphs = [];
if (!symBlock) {
  fail.push('Could not locate PIECE_SYMBOL in src/App.tsx');
} else {
  glyphs = [...symBlock[1].matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
  if (!glyphs.length) fail.push('PIECE_SYMBOL contained no glyphs');
}

// 2) The text-presentation fix must still be applied at render.
const hasVS = board.includes('\\uFE0E') || board.includes('︎');
if (!hasVS) {
  fail.push(
    'Board.tsx no longer appends the U+FE0E text variation selector — ' +
      'piece glyphs will render as color emoji on iOS and white (p1) pieces ' +
      'will appear black. (Restore the glyph += "\\uFE0E" in the marker render.)',
  );
}

// 3) Every piece glyph must be listed in PIECE_GLYPHS (the set that gets
//    the text selector). A new glyph added to PIECE_SYMBOL but not here
//    would silently regress on iOS.
const pgBlock = board.match(/PIECE_GLYPHS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
let guarded = [];
if (!pgBlock) {
  fail.push('Could not locate PIECE_GLYPHS set in src/Board.tsx');
} else {
  guarded = [...pgBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}
for (const g of glyphs) {
  if (!guarded.includes(g)) {
    fail.push(
      `Piece glyph ${JSON.stringify(g)} (from PIECE_SYMBOL) is missing from ` +
        `Board.tsx PIECE_GLYPHS — it won't be forced to text presentation and ` +
        `may render as a black emoji on iOS.`,
    );
  }
}

if (fail.length) {
  console.error('✗ render-invariants FAILED:');
  for (const f of fail) console.error('  - ' + f);
  process.exit(1);
}
console.log(
  `✓ render invariants OK — ${glyphs.length} piece glyphs (${glyphs.join(' ')}) ` +
    `forced to text presentation (U+FE0E), so p1/white pieces keep their fill on iOS.`,
);
