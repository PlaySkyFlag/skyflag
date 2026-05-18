// Canonical engine-player → faction display names. SINGLE SOURCE OF
// TRUTH for solo/HUD/review UI text.
//
// Ground truth (owner-confirmed in the chess-model rework, and what the
// board renderer itself uses — see Board.tsx, EvalGraph.tsx, PieceTray.tsx):
//   engine p1 = White Stags  (white/ivory, Player 1, moves first, BOTTOM)
//   engine p2 = Grey Ravens  (dark, TOP)
//
// This is DISPLAY only. It must not be used to derive stats keys or
// persisted/multiplayer role identifiers — those map to engine slots and
// are intentionally not renamed. Before this module, five components each
// re-declared this mapping by hand and three had it inverted, which is
// how a winning player got told the other faction won. Import from here.

import type { Player } from './types';

export const FACTION_NAME: Record<Player, string> = {
  p1: 'White Stags',
  p2: 'Grey Ravens',
};

/** Compact variant for dense UI (move history). */
export const FACTION_SHORT: Record<Player, string> = {
  p1: 'Stags',
  p2: 'Ravens',
};
