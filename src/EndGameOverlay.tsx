import { useEffect, useState } from 'react';
import type { GameState, Player } from './game/types';

const PLAYER_NAME: Record<Player, string> = { p1: 'Slate', p2: 'Ivory' };

const REASON_LABEL: Record<'nexus' | 'elimination' | 'turn-limit', string> = {
  nexus: 'Nexus capture',
  elimination: 'elimination',
  'turn-limit': 'turn limit reached',
};

type Props = {
  state: GameState;
  onPlayAgain: () => void;
};

// End-game celebration overlay. Renders when the game has finished (won or
// draw) and hasn't been dismissed via "View board". Auto-resets on the
// next game so it shows again when the next game ends.
export default function EndGameOverlay({ state, onPlayAgain }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // When a new game starts, allow the overlay to appear again next time.
    if (state.status.kind === 'in-progress') {
      setDismissed(false);
    }
  }, [state.status.kind]);

  if (state.status.kind === 'in-progress') return null;
  if (dismissed) return null;

  const isWin = state.status.kind === 'won';
  const winner: Player | null = isWin ? state.status.winner : null;
  const reason = state.status.reason;
  const cardClass = winner
    ? `end-game-card end-game-card--${winner}`
    : 'end-game-card';

  return (
    <div className="end-game-overlay" role="dialog" aria-modal="true">
      <div className={cardClass}>
        {winner && (
          <span className={`hud-pip hud-pip-${winner} end-game-pip`} aria-hidden />
        )}
        <h2 className="end-game-title">
          {isWin ? `${PLAYER_NAME[winner!]} wins!` : 'Draw'}
        </h2>
        <p className="end-game-reason">
          {isWin ? `by ${REASON_LABEL[reason]}` : REASON_LABEL[reason]}
        </p>
        <div className="end-game-actions">
          <button type="button" className="hud-btn" onClick={onPlayAgain}>
            Play again
          </button>
          <button
            type="button"
            className="hud-btn hud-btn-subtle"
            onClick={() => setDismissed(true)}
          >
            View board
          </button>
        </div>
      </div>
    </div>
  );
}
