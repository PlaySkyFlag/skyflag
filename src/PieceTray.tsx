import type { FlagsState, Layer, Piece, PieceId, PieceKind, Player } from './game/types';

const KIND_LABEL: Record<PieceKind, string> = {
  captain: 'Captain',
  soldier: 'Soldier',
  rover: 'Rover',
  pilot: 'Pilot',
};

const KIND_GLYPH: Record<PieceKind, string> = {
  captain: '♚',
  soldier: '♟',
  rover:   '♜',
  pilot:   '♝',
};

const PLAYER_LABEL: Record<Player, string> = {
  p1: 'Grey Ravens · Player 1',
  p2: 'White Stags · Player 2',
};

type Props = {
  player: Player;
  pieces: Piece[];
  capturedPieces: Piece[];
  isInteractive: boolean;
  selectedId: PieceId | null;
  onSelect: (id: PieceId) => void;
  // Short status text shown next to the tray label — e.g. activations
  // remaining, "waiting", "AI moving…", or end-game outcome.
  note: string;
  // Optional remaining-time display for chess-style time controls.
  // Pass undefined to omit the clock entirely (no-clock games).
  clockMs?: number;
  // True when this tray's player is the side currently on the clock —
  // drives the `tray-clock-active` style so the running clock reads
  // brighter than the paused one.
  clockActive?: boolean;
  // Full flags state — the tray derives THIS player's captured-flag
  // count (the opponent's flags they've taken) for the captured-flag
  // row. Win condition is all 3 captured + Captain on Nexus.
  flagsState?: FlagsState;
};

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PieceTray({
  player,
  pieces,
  capturedPieces,
  isInteractive,
  selectedId,
  onSelect,
  note,
  clockMs,
  clockActive,
  flagsState,
}: Props) {
  const opponent: Player = player === 'p1' ? 'p2' : 'p1';
  const layers: Layer[] = ['ground', 'sky', 'space'];
  const flagsCaptured = flagsState
    ? layers.filter((l) => flagsState[l][opponent])
    : [];
  return (
    <section
      className={`tray tray-${player}${isInteractive ? '' : ' tray-inactive'}`}
      aria-label={`${PLAYER_LABEL[player]} hand`}
    >
      <h3 className="tray-label">
        {PLAYER_LABEL[player]} · in hand
        <span className="tray-note">{note}</span>
        {clockMs !== undefined && (
          <span
            className={`tray-clock${clockActive ? ' tray-clock-active' : ''}${
              clockMs <= 30_000 ? ' tray-clock-low' : ''
            }`}
            aria-label={`${player} clock — ${formatClock(clockMs)} remaining`}
          >
            ⏱ {formatClock(clockMs)}
          </span>
        )}
      </h3>
      <div className="tray-pieces">
        {pieces.length === 0 ? (
          <span className="tray-empty">no pieces in hand</span>
        ) : (
          pieces.map((p) => {
            const isSelected = p.id === selectedId;
            const className = `tray-piece${isSelected ? ' tray-piece-selected' : ''}`;
            if (isInteractive) {
              return (
                <button
                  key={p.id}
                  type="button"
                  className={className}
                  title={KIND_LABEL[p.kind]}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(p.id)}
                >
                  <span className="tray-piece-letter">{KIND_GLYPH[p.kind]}</span>
                  <span className="tray-piece-name">{KIND_LABEL[p.kind]}</span>
                </button>
              );
            }
            return (
              <div key={p.id} className={className} title={KIND_LABEL[p.kind]}>
                <span className="tray-piece-letter">{KIND_GLYPH[p.kind]}</span>
                <span className="tray-piece-name">{KIND_LABEL[p.kind]}</span>
              </div>
            );
          })
        )}
      </div>

      {flagsState && (
        <div className="tray-flags" aria-label={`${PLAYER_LABEL[player]} captured flags`}>
          <span className="tray-flags-label">flags captured</span>
          <span className="tray-flags-row">
            {layers.map((layer) => {
              const taken = flagsState[layer][opponent];
              return (
                <span
                  key={layer}
                  className={`tray-flag-slot${taken ? ' tray-flag-slot-taken' : ''}`}
                  title={`${layer} — ${taken ? 'captured' : 'not captured'}`}
                >
                  ⚑<span className="tray-flag-layer">{layer[0].toUpperCase()}</span>
                </span>
              );
            })}
          </span>
          <span className="tray-flags-count">{flagsCaptured.length} / 3</span>
        </div>
      )}

      {capturedPieces.length > 0 && (
        <>
          <h4 className="tray-sublabel">captured</h4>
          <div className="tray-pieces">
            {capturedPieces.map((p, i) => {
              const wasPromoted = p.kind === 'captain' && p.promotedFromSoldier;
              return (
                <div
                  key={`${p.id}-captured-${i}`}
                  className="tray-piece tray-piece-captured"
                  title={`${KIND_LABEL[p.kind]}${wasPromoted ? ' (promoted from Soldier)' : ''} — lost`}
                >
                  <span className="tray-piece-letter">
                    {KIND_GLYPH[p.kind]}
                    {wasPromoted && <sup className="tray-piece-promoted-mark">★</sup>}
                  </span>
                  <span className="tray-piece-name">{KIND_LABEL[p.kind]}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
