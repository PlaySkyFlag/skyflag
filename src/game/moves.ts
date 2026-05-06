import { BOARD_SIZE, FORWARD_ROW_DELTA, LIFT_CELLS } from './constants';
import type { BoardPiece, Coord, GameState, Layer } from './types';

const LAYER_ABOVE: Partial<Record<Layer, Layer>> = {
  ground: 'sky',
  sky: 'space',
};

const LAYER_BELOW: Partial<Record<Layer, Layer>> = {
  space: 'sky',
  sky: 'ground',
};

function isLiftCell(row: number, col: number): boolean {
  return LIFT_CELLS.some((c) => c.row === row && c.col === col);
}

const KING_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
] as const;

const ORTHOGONAL_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
] as const;

const DIAGONAL_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
] as const;

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.layer === b.layer && a.row === b.row && a.col === b.col;
}

export function pieceAt(state: GameState, c: Coord): BoardPiece | undefined {
  return state.onBoard.find((bp) => sameCoord(bp.coord, c));
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

// Legal destinations for a piece, including same-layer movement AND any legal
// lift steps to adjacent layers. Cross-layer Coords let App route the dot to
// the correct Board automatically.
//
// Movement geometry:
//   Captain   king-move (1 sq, 8 dirs)
//   Soldier   forward + diagonal-forward capture (with first-move 2 sq)
//   Rover     orthogonal ≤2 sq, captures at 1 OR 2 (true limited rook)
//   Pilot     diagonal ≤2 sq, captures at 1 OR 2 (limited bishop)
// Neither Rover nor Pilot may jump.
//
// Lift step (any piece):
//   Must be on a lift cell at start of activation. Cannot have arrived this
//   turn (two-turn rule). Destination cell on adjacent layer must be empty —
//   lift step cannot capture.
export function legalMovesFor(boardPiece: BoardPiece, state: GameState): Coord[] {
  return movementMovesFor(boardPiece, state).concat(legalLiftSteps(boardPiece, state));
}

export function legalLiftSteps(bp: BoardPiece, state: GameState): Coord[] {
  if (!isLiftCell(bp.coord.row, bp.coord.col)) return [];
  if (bp.arrivedOnLiftThisTurn) return [];

  const targets: Coord[] = [];
  const above = LAYER_ABOVE[bp.coord.layer];
  if (above) {
    const t: Coord = { layer: above, row: bp.coord.row, col: bp.coord.col };
    if (!pieceAt(state, t)) targets.push(t);
  }
  const below = LAYER_BELOW[bp.coord.layer];
  if (below) {
    const t: Coord = { layer: below, row: bp.coord.row, col: bp.coord.col };
    if (!pieceAt(state, t)) targets.push(t);
  }
  return targets;
}

function movementMovesFor(boardPiece: BoardPiece, state: GameState): Coord[] {
  const { piece, coord } = boardPiece;

  if (piece.kind === 'captain') {
    const moves: Coord[] = [];
    for (const [dr, dc] of KING_DELTAS) {
      const r = coord.row + dr;
      const c = coord.col + dc;
      if (!inBounds(r, c)) continue;
      const target: Coord = { layer: coord.layer, row: r, col: c };
      const occupant = pieceAt(state, target);
      if (occupant && occupant.piece.owner === piece.owner) continue;
      moves.push(target);
    }
    return moves;
  }

  if (piece.kind === 'soldier') {
    const dir = FORWARD_ROW_DELTA[piece.owner];
    const moves: Coord[] = [];

    // Straight forward 1 square — destination must be empty (no forward capture).
    const oneRow = coord.row + dir;
    if (inBounds(oneRow, coord.col)) {
      const oneAhead: Coord = { layer: coord.layer, row: oneRow, col: coord.col };
      if (!pieceAt(state, oneAhead)) {
        moves.push(oneAhead);

        // Two-square first move: only if the soldier hasn't moved yet AND both
        // intermediate (oneAhead) and destination cells are empty.
        if (!piece.hasMoved) {
          const twoRow = coord.row + 2 * dir;
          if (inBounds(twoRow, coord.col)) {
            const twoAhead: Coord = { layer: coord.layer, row: twoRow, col: coord.col };
            if (!pieceAt(state, twoAhead)) moves.push(twoAhead);
          }
        }
      }
    }

    // Diagonal-forward captures — destination must contain an opponent piece.
    for (const dc of [-1, 1]) {
      const r = coord.row + dir;
      const c = coord.col + dc;
      if (!inBounds(r, c)) continue;
      const target: Coord = { layer: coord.layer, row: r, col: c };
      const occupant = pieceAt(state, target);
      if (occupant && occupant.piece.owner !== piece.owner) moves.push(target);
    }

    return moves;
  }

  if (piece.kind === 'pilot') {
    const moves: Coord[] = [];
    for (const [dr, dc] of DIAGONAL_DELTAS) {
      // 1 step: empty or opponent. Friendly blocks both 1- and 2-step.
      const r1 = coord.row + dr;
      const c1 = coord.col + dc;
      if (!inBounds(r1, c1)) continue;
      const t1: Coord = { layer: coord.layer, row: r1, col: c1 };
      const occ1 = pieceAt(state, t1);
      if (occ1 && occ1.piece.owner === piece.owner) continue;
      moves.push(t1);

      // 2 step: only legal if the intermediate (t1) is EMPTY (no jumping).
      // Unlike the Rover, the Pilot CAN capture at distance 2 — destination
      // may be empty or opponent.
      if (occ1) continue;
      const r2 = coord.row + 2 * dr;
      const c2 = coord.col + 2 * dc;
      if (!inBounds(r2, c2)) continue;
      const t2: Coord = { layer: coord.layer, row: r2, col: c2 };
      const occ2 = pieceAt(state, t2);
      if (occ2 && occ2.piece.owner === piece.owner) continue;
      moves.push(t2);
    }
    return moves;
  }

  if (piece.kind === 'rover') {
    const moves: Coord[] = [];
    for (const [dr, dc] of ORTHOGONAL_DELTAS) {
      // 1 step: empty or opponent. Friendly blocks both 1- and 2-step.
      const r1 = coord.row + dr;
      const c1 = coord.col + dc;
      if (!inBounds(r1, c1)) continue;
      const t1: Coord = { layer: coord.layer, row: r1, col: c1 };
      const occ1 = pieceAt(state, t1);
      if (occ1 && occ1.piece.owner === piece.owner) continue;
      moves.push(t1);

      // 2 steps: only legal if intermediate (t1) is empty (no jumping).
      // Destination may be empty or opponent (capture-by-landing at 2 sq is
      // allowed — Rover behaves as a true limited rook, revised from v19.1
      // which restricted capture to 1 sq).
      if (occ1) continue;
      const r2 = coord.row + 2 * dr;
      const c2 = coord.col + 2 * dc;
      if (!inBounds(r2, c2)) continue;
      const t2: Coord = { layer: coord.layer, row: r2, col: c2 };
      const occ2 = pieceAt(state, t2);
      if (occ2 && occ2.piece.owner === piece.owner) continue;
      moves.push(t2);
    }
    return moves;
  }

  return [];
}
