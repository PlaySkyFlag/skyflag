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

// A piece on the board — has a coord. The lift rule (revised from v19.1)
// requires two separate activations to transit; with each click being one
// activation, the constraint is automatic and no per-piece transient state
// is needed.
export type BoardPiece = {
  piece: Piece;
  coord: Coord;
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

// ─── Move history ──────────────────────────────────────────────────────────

export type HistoryEntry =
  | {
      kind: 'deploy';
      turn: number;
      player: Player;
      pieceKind: PieceKind;
      coord: Coord;
    }
  | {
      kind: 'move';
      turn: number;
      player: Player;
      pieceKind: PieceKind;
      from: Coord;
      to: Coord;
      // Set when this move ended with a capture.
      captured?: { kind: PieceKind; owner: Player };
      // Set when a Soldier promoted to Captain on the far Ground row.
      promoted?: boolean;
      // Set when a Captain landed on a flag and removed it from the board.
      flagCaptured?: { layer: Layer; owner: Player };
    }
  | {
      kind: 'end-turn';
      turn: number;
      player: Player;
    };

// ─── Multiplayer room ──────────────────────────────────────────────────────

// Per-device snapshot of which Supabase room the user is in. Persisted to
// localStorage so a refresh restores the room (the Supabase row is the
// authoritative source of truth — this just remembers our seat).
export type RoomState = {
  code: string;
  role: Player;
  status: 'waiting' | 'playing';
};

// ─── Whole game state ──────────────────────────────────────────────────────

export type GameState = {
  inHand: Record<Player, Piece[]>;
  onBoard: BoardPiece[];
  // Pieces each player has lost. captured.p1 = pieces P1 has lost.
  captured: Record<Player, Piece[]>;
  flags: FlagsState;
  currentPlayer: Player;
  activationsRemaining: number;
  turnNumber: number;
  status: GameStatus;
  // Append-only running log of every player action, oldest first.
  history: HistoryEntry[];
};
