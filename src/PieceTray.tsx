import type { Piece, PieceKind, Player } from './game/types';

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
};

export default function PieceTray({ player, pieces }: Props) {
  return (
    <section className={`tray tray-${player}`} aria-label={`${PLAYER_LABEL[player]} hand`}>
      <h3 className="tray-label">{PLAYER_LABEL[player]} · in hand</h3>
      <div className="tray-pieces">
        {pieces.length === 0 ? (
          <span className="tray-empty">no pieces in hand</span>
        ) : (
          pieces.map((p) => (
            <div key={p.id} className="tray-piece" title={KIND_LABEL[p.kind]}>
              <div className="tray-piece-letter">{KIND_LETTER[p.kind]}</div>
              <div className="tray-piece-name">{KIND_LABEL[p.kind]}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
