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

// Pre-baked time control options shown in the gear menu. `minutes: 0`
// means no clock at all. Total per side, decremented while their turn
// is active; running out hands the win to the opponent by 'time-out'.
export const CLOCK_OPTIONS = [
  { id: 'off',  label: 'No clock',    minutes: 0  },
  { id: '5',    label: '5 min',       minutes: 5  },
  { id: '10',   label: '10 min',      minutes: 10 },
  { id: '30',   label: '30 min',      minutes: 30 },
] as const;
export type ClockOptionId = (typeof CLOCK_OPTIONS)[number]['id'];

export function clockMsForOption(id: ClockOptionId): number {
  const opt = CLOCK_OPTIONS.find((o) => o.id === id);
  return (opt?.minutes ?? 0) * 60_000;
}

export function createInitialGameState(clockMs?: number): GameState {
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
    captured: { p1: [], p2: [] },
    flags,
    currentPlayer: 'p1',
    activationsRemaining: ACTIVATIONS_PER_TURN,
    turnNumber: 1,
    status: { kind: 'in-progress' },
    history: [],
    ...(clockMs && clockMs > 0
      ? { clock: { p1Ms: clockMs, p2Ms: clockMs, lastTickAt: null } }
      : {}),
  };
}
