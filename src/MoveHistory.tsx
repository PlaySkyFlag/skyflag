import { useEffect, useRef } from 'react';
import type { Coord, HistoryEntry, Layer, PieceKind, Player } from './game/types';

const PLAYER_NAME: Record<Player, string> = { p1: 'Slate', p2: 'Ivory' };

const PIECE_GLYPH: Record<PieceKind, string> = {
  captain: '♚',
  soldier: '♟',
  rover: '♜',
  pilot: '♝',
};

// Single-letter layer codes for the compact cell notation in entries.
const LAYER_CODE: Record<Layer, string> = {
  ground: 'T', // Terran
  sky: 'M',    // Meridian
  space: 'E',  // Empyrean
};

const cellNotation = (c: Coord): string =>
  `${LAYER_CODE[c.layer]}(${c.row},${c.col})`;

type Props = {
  history: HistoryEntry[];
};

export default function MoveHistory({ history }: Props) {
  // Auto-scroll the list to the latest entry whenever a move is appended,
  // so the most recent action is always visible without manual scrolling.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  return (
    <details className="help">
      <summary className="help-summary">
        Move history{history.length > 0 ? ` (${history.length})` : ''}
      </summary>
      <div className="help-body">
        {history.length === 0 ? (
          <p className="move-history-empty">No moves yet.</p>
        ) : (
          <ol className="move-history-list" ref={listRef}>
            {history.map((entry, i) => (
              <li
                key={i}
                className={`move-history-entry move-history-${entry.player}`}
              >
                <span className="move-history-turn">T{entry.turn}</span>
                <span className={`hud-pip hud-pip-${entry.player}`} aria-hidden />
                <span className="move-history-text">{describe(entry)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

function describe(entry: HistoryEntry): string {
  const player = PLAYER_NAME[entry.player];
  switch (entry.kind) {
    case 'deploy':
      return `${player} deploys ${PIECE_GLYPH[entry.pieceKind]} at ${cellNotation(entry.coord)}`;
    case 'move': {
      let s = `${player} ${PIECE_GLYPH[entry.pieceKind]} ${cellNotation(entry.from)} → ${cellNotation(entry.to)}`;
      if (entry.captured) {
        s += ` × ${PIECE_GLYPH[entry.captured.kind]}`;
      }
      if (entry.promoted) s += ' ★';
      if (entry.flagCaptured) s += ` ⚑ (${entry.flagCaptured.layer})`;
      return s;
    }
    case 'end-turn':
      return `${player} ends turn`;
  }
}
