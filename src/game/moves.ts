import { BOARD_SIZE, FORWARD_ROW_DELTA } from './constants';
import type { BoardPiece, Coord, GameState } from './types';

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

// All legal destinations for a piece, on the same layer.
// Captain: king-move. Soldier: forward + diagonal capture. Rover: orthogonal
// ≤2 sq (true limited rook — captures at any reachable distance). Pilot:
// diagonal ≤2 sq (limited bishop). Neither Rover nor Pilot may jump.
export function legalMovesFor(boardPiece: BoardPiece, state: GameState): Coord[] {
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
