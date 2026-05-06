import type { Piece, PieceId, PieceKind, Player } from './game/types';

const KIND_LABEL: Record<PieceKind, string> = {
  captain: 'Captain',
  soldier: 'Soldier',
  rover: 'Rover',
  pilot: 'Pilot',
};

const KIND_LETTER: Record<PieceKind, string> = {
  captain: 'C',
  soldier: 'S',
  rover: 'R',
  pilot: 'P',
};

const PLAYER_LABEL: Record<Player, string> = {
  p1: 'Slate · Player 1',
  p2: 'Ivory · Player 2',
};

type Props = {
  player: Player;
  pieces: Piece[];
  capturedPieces: Piece[];
  isInteractive: boolean;
  selectedId: PieceId | null;
  onSelect: (id: PieceId) => void;
};

export default function PieceTray({
  player,
  pieces,
  capturedPieces,
  isInteractive,
  selectedId,
  onSelect,
}: Props) {
  return (
    <section
      className={`tray tray-${player}${isInteractive ? '' : ' tray-inactive'}`}
      aria-label={`${PLAYER_LABEL[player]} hand`}
    >
      <h3 className="tray-label">{PLAYER_LABEL[player]} · in hand</h3>
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
                  <span className="tray-piece-letter">{KIND_LETTER[p.kind]}</span>
                  <span className="tray-piece-name">{KIND_LABEL[p.kind]}</span>
                </button>
              );
            }
            return (
              <div key={p.id} className={className} title={KIND_LABEL[p.kind]}>
                <span className="tray-piece-letter">{KIND_LETTER[p.kind]}</span>
                <span className="tray-piece-name">{KIND_LABEL[p.kind]}</span>
              </div>
            );
          })
        )}
      </div>

      {capturedPieces.length > 0 && (
        <>
          <h4 className="tray-sublabel">captured</h4>
          <div className="tray-pieces">
            {capturedPieces.map((p, i) => (
              <div
                key={`${p.id}-captured-${i}`}
                className="tray-piece tray-piece-captured"
                title={`${KIND_LABEL[p.kind]} (lost)`}
              >
                <span className="tray-piece-letter">{KIND_LETTER[p.kind]}</span>
                <span className="tray-piece-name">{KIND_LABEL[p.kind]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
