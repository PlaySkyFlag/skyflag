// Shape of every game-state thing in SkyFlag. Pure types — no runtime values
// here. Pair with constants.ts for fixed positions and the initial-state factory.

// ─── Geometry ──────────────────────────────────────────────────────────────

export type Layer = 'ground' | 'sky' | 'space';

export type Coord = {
  layer: Layer;
  row: number; // 0–5
  col: number; // 0–5
};

// ─── Players ───────────────────────────────────────────────────────────────

export type Player = 'p1' | 'p2';

export const opponentOf = (p: Player): Player => (p === 'p1' ? 'p2' : 'p1');

// ─── Pieces ────────────────────────────────────────────────────────────────

export type PieceKind = 'captain' | 'soldier' | 'rover' | 'pilot';

export type PieceId = string;

type PieceCommon = {
  id: PieceId;
  owner: Player;
};

export type CaptainPiece = PieceCommon & {
  kind: 'captain';
  promotedFromSoldier: boolean;
};

export type SoldierPiece = PieceCommon & {
  kind: 'soldier';
  hasMoved: boolean;
};

export type RoverPiece = PieceCommon & { kind: 'rover' };
export type PilotPiece = PieceCommon & { kind: 'pilot' };

export type Piece = CaptainPiece | SoldierPiece | RoverPiece | PilotPiece;

// A piece on the board — has a coord and one piece of transient turn-state.
export type BoardPiece = {
  piece: Piece;
  coord: Coord;
  arrivedOnLiftThisTurn: boolean;
};

// ─── Flags ─────────────────────────────────────────────────────────────────
// `true` means the flag has been captured (and removed from the board).

export type FlagsState = {
  ground: { p1: boolean; p2: boolean };
  sky:    { p1: boolean; p2: boolean };
  space:  { p1: boolean; p2: boolean };
};

// ─── Game outcome ──────────────────────────────────────────────────────────

export type GameStatus =
  | { kind: 'in-progress' }
  | { kind: 'won'; winner: Player; reason: 'nexus' | 'elimination' }
  | { kind: 'draw'; reason: 'turn-limit' };

// ─── Whole game state ──────────────────────────────────────────────────────

export type GameState = {
  inHand: Record<Player, Piece[]>;
  onBoard: BoardPiece[];
  flags: FlagsState;
  currentPlayer: Player;
  activationsRemaining: number;
  turnNumber: number;
  status: GameStatus;
};
