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

/** Encode a position into a fixed-length P1-perspective feature vector. */
export function encodeState(state: GameState): Float32Array {
  const x = new Float32Array(INPUT_DIM);

  for (const bp of state.onBoard) {
    x[boardIndex(bp.coord.layer, bp.coord.row, bp.coord.col, bp.piece.owner, bp.piece.kind)] = 1;
  }

  for (const owner of ['p1', 'p2'] as Player[]) {
    for (const p of state.inHand[owner]) {
      // Normalised count (≤ a few of each kind in hand).
      x[HAND_OFF + ownerIdx(owner) * 4 + kindIdx(p.kind)] += 0.25;
    }
  }

  for (const l of LAYERS) {
    if (state.flags[l].p1) x[FLAG_OFF + layerIdx(l) * 2 + 0] = 1;
    if (state.flags[l].p2) x[FLAG_OFF + layerIdx(l) * 2 + 1] = 1;
  }

  x[SCALAR_OFF + 0] = state.currentPlayer === 'p1' ? 1 : 0;
  x[SCALAR_OFF + 1] = (state.activationsRemaining ?? 0) / 2;

  return x;
}
