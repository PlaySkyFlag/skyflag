import { BOARD_SIZE, FORWARD_ROW_DELTA } from './constants';
import type { BoardPiece, Coord, GameState } from './types';

const KING_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
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
// Implemented today: Captain (king-move), Soldier (forward + diagonal capture).
// Other piece types return [] until implemented.
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

  return [];
}
