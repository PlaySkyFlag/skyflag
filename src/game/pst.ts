// Piece-Square Tables — positional bonuses by (piece kind, layer, row, col).
//
// Chess engines use these to encode "where a piece wants to be" cheaply: a
// table lookup adds strategic intuition that the search would otherwise have
// to discover the hard way (by burning depth on positional shuffles).
//
// Skyflag's existing evaluation already handles material, threats, and the
// distance to the next target flag. PSTs add the things that distance-to-
// target doesn't capture: center control, lift proximity, avoiding back
// ranks, and the layer-specific value of the Nexus square.
//
// Tables are written from P1's perspective — P1 deploys at row 0 and advances
// toward row 5. For P2 we mirror the row axis (row N becomes row 5-N) since
// the board is symmetric and P2 advances in the opposite direction.
//
// Magnitudes are tuned to fit alongside the other evaluation terms:
//   - Material: 60 (rover/pilot) to 700 (captain)
//   - Distance-to-target penalty: ~3 per square
//   - Mobility: 1.2 per legal move
// PST values cap around 22 — meaningful pull without overriding material.

import { BOARD_SIZE } from './constants';
import type { Coord, Layer, Piece, PieceKind, Player } from './types';

// Soldiers want to advance (forward = high row from P1's view) and stay
// central for mobility. Their strongest squares are the opponent's back
// ranks, where they threaten flags directly and (via promotion) become
// Captains. Sky/Space tables are flatter — Soldiers only reach those
// layers via lifts, so the tables mostly say "having advanced is good."
const SOLDIER_PST: Record<Layer, number[][]> = {
  ground: [
    [ 0,  0,  0,  0,  0,  0],
    [ 2,  4,  6,  6,  4,  2],
    [ 4,  8, 12, 12,  8,  4],
    [ 6, 12, 16, 16, 12,  6],
    [ 8, 16, 20, 20, 16,  8],
    [12, 18, 22, 22, 18, 12],
  ],
  sky: [
    [ 0,  0,  0,  0,  0,  0],
    [ 0,  2,  4,  4,  2,  0],
    [ 2,  4,  6,  6,  4,  2],
    [ 4,  6,  8,  8,  6,  4],
    [ 6,  8, 10, 10,  8,  6],
    [ 8, 10, 12, 12, 10,  8],
  ],
  space: [
    [ 0,  0,  0,  0,  0,  0],
    [ 0,  2,  4,  4,  2,  0],
    [ 2,  4,  8,  8,  4,  2],
    [ 4,  8, 14, 14,  8,  4],
    [ 6, 10, 14, 14, 10,  6],
    [ 8, 12, 16, 16, 12,  8],
  ],
};

// Captains avoid corners (limited mobility, easier to trap) and prefer
// central squares. Slight forward bias because Captains capture flags
// by occupying flag squares. The Space table emphasizes the Nexus
// (space(3,3)) since that's the fallback win condition once all flags
// are taken.
const CAPTAIN_PST: Record<Layer, number[][]> = {
  ground: [
    [-8, -4, -2, -2, -4, -8],
    [-4,  0,  2,  2,  0, -4],
    [-2,  2,  6,  6,  2, -2],
    [ 0,  4,  8,  8,  4,  0],
    [ 2,  6, 10, 10,  6,  2],
    [ 4,  8, 12, 12,  8,  4],
  ],
  sky: [
    [-6, -2,  0,  0, -2, -6],
    [-2,  2,  4,  4,  2, -2],
    [ 0,  4,  8,  8,  4,  0],
    [ 2,  6, 10, 10,  6,  2],
    [ 4,  8, 12, 12,  8,  4],
    [ 6, 10, 14, 14, 10,  6],
  ],
  space: [
    [-4,  0,  2,  2,  0, -4],
    [ 0,  4,  6,  6,  4,  0],
    [ 2,  6, 12, 12,  6,  2],
    [ 4,  8, 14, 18,  8,  4],   // (3,3) = Nexus
    [ 6, 10, 16, 16, 10,  6],
    [ 8, 12, 18, 18, 12,  8],
  ],
};

// Rovers and Pilots both enable layer transitions — they're most valuable
// adjacent to lift squares (1,1), (1,4), (4,1), (4,4) where they can pick
// up other pieces. Layer-uniform: a transport piece's job doesn't really
// change between Ground and Sky. Tiny Nexus bonus on Space because being
// the piece that controls the Nexus tile from the support layer is useful.
const TRANSPORT_PST: Record<Layer, number[][]> = {
  ground: [
    [ 0,  2,  4,  4,  2,  0],
    [ 2, 10,  6,  6, 10,  2],   // lifts at (1,1) and (1,4)
    [ 4,  6,  8,  8,  6,  4],
    [ 4,  6,  8,  8,  6,  4],
    [ 2, 10,  6,  6, 10,  2],   // lifts at (4,1) and (4,4)
    [ 0,  2,  4,  4,  2,  0],
  ],
  sky: [
    [ 0,  2,  4,  4,  2,  0],
    [ 2, 10,  6,  6, 10,  2],
    [ 4,  6,  8,  8,  6,  4],
    [ 4,  6,  8,  8,  6,  4],
    [ 2, 10,  6,  6, 10,  2],
    [ 0,  2,  4,  4,  2,  0],
  ],
  space: [
    [ 0,  2,  4,  4,  2,  0],
    [ 2, 10,  6,  6, 10,  2],
    [ 4,  6,  8, 10,  6,  4],   // (2,3) +2 — Nexus support
    [ 4,  6, 10, 18,  8,  4],   // (3,3) Nexus 12→18; (3,2)+2, (3,4)+2
    [ 2, 10,  6,  8, 10,  2],   // (4,3) +2 — Nexus support
    [ 0,  2,  4,  4,  2,  0],
  ],
};

export type PstTables = Record<PieceKind, Record<Layer, number[][]>>;

// Deep clone so each kind owns independent tables. Notably rover and
// pilot historically shared the TRANSPORT_PST object by reference; an
// offline fitter must be able to diverge them. Values are the exact
// shipped literals, so default behaviour is byte-identical.
function clonePlanes(t: Record<Layer, number[][]>): Record<Layer, number[][]> {
  return {
    ground: t.ground.map((r) => r.slice()),
    sky: t.sky.map((r) => r.slice()),
    space: t.space.map((r) => r.slice()),
  };
}

export function defaultPstTables(): PstTables {
  return {
    soldier: clonePlanes(SOLDIER_PST),
    captain: clonePlanes(CAPTAIN_PST),
    rover: clonePlanes(TRANSPORT_PST),
    pilot: clonePlanes(TRANSPORT_PST),
  };
}

let activeTables: PstTables = defaultPstTables();

/**
 * Swap in fitted PST tables (offline tuning / the selfplay A/B harness,
 * mirroring setEvalParams). Pass null/undefined to reset to the shipped
 * defaults. The app never calls this, so shipped behaviour is the
 * defaults — verified byte-identical to the pre-swappable implementation
 * across all 864 kind×layer×row×col×owner inputs.
 */
export function setPstTables(t?: PstTables | null): void {
  activeTables = t ?? defaultPstTables();
}

export function getPstTables(): PstTables {
  return activeTables;
}

// Returns the positional bonus for `piece` at `coord` from its owner's
// perspective. Positive = good for the owner. Caller decides whether to
// add or subtract this from the global score depending on whether the
// piece belongs to the side being evaluated.
export function pstScore(piece: Piece, coord: Coord): number {
  const table = activeTables[piece.kind][coord.layer];
  // Tables are written from P1's perspective. P2 mirrors row-wise since
  // the board flips along the row axis (P2 advances row 5 → row 0).
  const row = piece.owner === 'p1' ? coord.row : BOARD_SIZE - 1 - coord.row;
  return table[row][coord.col];
}

// Re-export so callers can avoid a cross-package Player import just to
// thread the type through. Not actually used internally — exposed for
// future tuning hooks (e.g. a UI to view the AI's positional weights).
export type { Player };
