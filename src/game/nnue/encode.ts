// Shared board → input-feature encoding for the learned evaluator.
//
// CRITICAL: training (scripts/nnue-train.ts) and engine inference must
// use this exact function. Any change to the layout is a model-breaking
// change — retrain, don't hand-edit.
//
// All features are from PLAYER 1's perspective, matching the deep-search
// target `ds` (also P1-perspective). The net therefore predicts a
// P1-favourability score; the engine negates it for p2-to-move nodes
// the same way evaluate() is sign-normalised today.

import type { GameState, Layer, PieceKind, Player } from '../types';

const LAYERS: Layer[] = ['ground', 'sky', 'space'];
const KINDS: PieceKind[] = ['captain', 'soldier', 'rover', 'pilot'];
const BOARD = 6;

const layerIdx = (l: Layer) => LAYERS.indexOf(l);
const kindIdx = (k: PieceKind) => KINDS.indexOf(k);
const ownerIdx = (o: Player) => (o === 'p1' ? 0 : 1);

// Block 0: piece planes — layer × row × col × owner × kind, one-hot per
// occupied cell. 3·6·6·2·4 = 1728.
const PLANE = BOARD * BOARD * 2 * 4; // per layer = 288
const BOARD_FEATS = LAYERS.length * PLANE; // 1728

// Block 1: in-hand counts, owner × kind, normalised. 8.
const HAND_FEATS = 2 * 4;
// Block 2: flags captured, layer × owner. 6.
const FLAG_FEATS = LAYERS.length * 2;
// Block 3: scalars — side-to-move, activations-remaining. 2.
const SCALAR_FEATS = 2;

export const INPUT_DIM =
  BOARD_FEATS + HAND_FEATS + FLAG_FEATS + SCALAR_FEATS; // 1744

const HAND_OFF = BOARD_FEATS;
const FLAG_OFF = HAND_OFF + HAND_FEATS;
const SCALAR_OFF = FLAG_OFF + FLAG_FEATS;

function boardIndex(
  l: Layer,
  row: number,
  col: number,
  owner: Player,
  kind: PieceKind,
): number {
  return (
    layerIdx(l) * PLANE +
    ((row * BOARD + col) * 2 + ownerIdx(owner)) * 4 +
    kindIdx(kind)
  );
}

/**
 * Sparse P1-perspective encoding: parallel `index`/`value` arrays of the
 * non-zero features only (~40 of INPUT_DIM). This is the SINGLE SOURCE OF
 * TRUTH for the feature layout — `encodeState` densifies this, and the
 * incremental accumulator (nnue/accumulator.ts) diffs two of these. Keeping
 * one producer means the dense path, the trainer, and the accumulator can
 * never silently disagree on the layout.
 *
 * Zero-valued features are omitted (a dense vector is implicitly 0 there).
 * A feature whose VALUE changes (in-hand counts accumulate at 0.25 each;
 * the activations scalar is 0/0.5/1) appears once with its summed value, so
 * a map-diff of two sparse encodings yields exact per-feature deltas.
 */
export function encodeSparse(state: GameState): { index: number[]; value: number[] } {
  // Accumulate into a map so repeated in-hand pieces sum into one bucket,
  // exactly as the dense `+= 0.25` did.
  const acc = new Map<number, number>();
  const bump = (i: number, v: number) => acc.set(i, (acc.get(i) ?? 0) + v);

  for (const bp of state.onBoard) {
    acc.set(
      boardIndex(bp.coord.layer, bp.coord.row, bp.coord.col, bp.piece.owner, bp.piece.kind),
      1,
    );
  }

  for (const owner of ['p1', 'p2'] as Player[]) {
    for (const p of state.inHand[owner]) {
      bump(HAND_OFF + ownerIdx(owner) * 4 + kindIdx(p.kind), 0.25);
    }
  }

  for (const l of LAYERS) {
    if (state.flags[l].p1) acc.set(FLAG_OFF + layerIdx(l) * 2 + 0, 1);
    if (state.flags[l].p2) acc.set(FLAG_OFF + layerIdx(l) * 2 + 1, 1);
  }

  if (state.currentPlayer === 'p1') acc.set(SCALAR_OFF + 0, 1);
  const actScalar = (state.activationsRemaining ?? 0) / 2;
  if (actScalar !== 0) acc.set(SCALAR_OFF + 1, actScalar);

  const index: number[] = [];
  const value: number[] = [];
  for (const [i, v] of acc) {
    index.push(i);
    value.push(v);
  }
  return { index, value };
}

/**
 * Encode a position into a fixed-length P1-perspective feature vector.
 * Byte-identical to the prior hand-written densification (verified by the
 * parity harness) — it now just densifies `encodeSparse` so there is one
 * authoritative layout.
 */
export function encodeState(state: GameState): Float32Array {
  const x = new Float32Array(INPUT_DIM);
  const { index, value } = encodeSparse(state);
  for (let k = 0; k < index.length; k++) x[index[k]] = value[k];
  return x;
}
