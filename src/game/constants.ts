import type {
  Coord,
  FlagsState,
  GameState,
  Layer,
  Piece,
  Player,
} from './types';

// ─── Board / rules constants ───────────────────────────────────────────────

export const BOARD_SIZE = 6;
export const ACTIVATIONS_PER_TURN = 2;
export const TURN_LIMIT = 180;

// Display order, top to bottom.
export const LAYER_ORDER: readonly Layer[] = ['space', 'sky', 'ground'] as const;

// Lift positions are identical on every layer.
export const LIFT_CELLS: ReadonlyArray<{ row: number; col: number }> = [
  { row: 1, col: 1 },
  { row: 1, col: 4 },
  { row: 4, col: 1 },
  { row: 4, col: 4 },
] as const;

export const NEXUS_COORD: Coord = { layer: 'space', row: 3, col: 3 };

export const FLAG_COORDS: Record<Player, Record<Layer, { row: number; col: number }>> = {
  p1: {
    ground: { row: 0, col: 0 },
    sky:    { row: 0, col: 5 },
    space:  { row: 0, col: 0 },
  },
  p2: {
    ground: { row: 5, col: 5 },
    sky:    { row: 5, col: 0 },
    space:  { row: 5, col: 5 },
  },
};

export const DEPLOY_COORDS: Record<Player, Coord> = {
  p1: { layer: 'ground', row: 0, col: 3 },
  p2: { layer: 'ground', row: 5, col: 2 },
};

// Direction a Soldier advances on Ground (P1 starts at row 0, advances to row 5).
export const FORWARD_ROW_DELTA: Record<Player, 1 | -1> = {
  p1: 1,
  p2: -1,
};

// ─── Initial state factory ─────────────────────────────────────────────────

const buildPiecesFor = (owner: Player): Piece[] => [
  { id: `${owner}-captain`, owner, kind: 'captain', promotedFromSoldier: false },
  { id: `${owner}-soldier`, owner, kind: 'soldier', hasMoved: false },
  { id: `${owner}-rover`,   owner, kind: 'rover' },
  { id: `${owner}-pilot`,   owner, kind: 'pilot' },
];

export function createInitialGameState(): GameState {
  const flags: FlagsState = {
    ground: { p1: false, p2: false },
    sky:    { p1: false, p2: false },
    space:  { p1: false, p2: false },
  };

  return {
    inHand: {
      p1: buildPiecesFor('p1'),
      p2: buildPiecesFor('p2'),
    },
    onBoard: [],
    flags,
    currentPlayer: 'p1',
    activationsRemaining: ACTIVATIONS_PER_TURN,
    turnNumber: 1,
    status: { kind: 'in-progress' },
  };
}
