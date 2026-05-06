import { BOARD_SIZE } from './constants';
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

// All legal destinations for a piece, on the same layer.
// Today: Captain only (king-move). Other piece types return [] until implemented.
export function legalMovesFor(boardPiece: BoardPiece, state: GameState): Coord[] {
  const { piece, coord } = boardPiece;

  if (piece.kind === 'captain') {
    const moves: Coord[] = [];
    for (const [dr, dc] of KING_DELTAS) {
      const r = coord.row + dr;
      const c = coord.col + dc;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
      const target: Coord = { layer: coord.layer, row: r, col: c };
      const occupant = pieceAt(state, target);
      if (occupant && occupant.piece.owner === piece.owner) continue;
      moves.push(target);
    }
    return moves;
  }

  return [];
}
