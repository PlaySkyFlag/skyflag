// Thin row of game-context actions, pinned just above the boards.
// Mirrors the layout chess.com / lichess use — Resign / Draw / Hint /
// New game live next to the play surface, separated from app-level
// settings (which sit behind the gear icon in the header).
//
// The clock dropdown sits right next to "New game" so the user always
// sees what time control is about to apply — no more silently
// inheriting a 10-minute clock from a setting they configured last week.
// Changes apply to the NEXT new game; the current game keeps its
// running clock untouched.

import { CLOCK_OPTIONS, type ClockOptionId } from './game/constants';

type Props = {
  onRequestHint: () => void;
  hintEnabled: boolean;
  onOfferDraw: () => void;
  onResign: () => void;
  onNewGame: () => void;
  clockOption: ClockOptionId;
  onSetClockOption: (id: ClockOptionId) => void;
  // True once the game is over — Hint / Draw / Resign turn into disabled
  // affordances so the bar stays visually stable instead of half the
  // buttons disappearing the moment someone wins.
  gameOver: boolean;
};

export default function GameToolbar({
  onRequestHint,
  hintEnabled,
  onOfferDraw,
  onResign,
  onNewGame,
  clockOption,
  onSetClockOption,
  gameOver,
}: Props) {
  return (
    <div className="game-toolbar" role="toolbar" aria-label="Game actions">
      <button
        type="button"
        className="hud-btn hud-btn-subtle"
        onClick={onRequestHint}
        disabled={!hintEnabled || gameOver}
        title={
          gameOver
            ? 'Game over'
            : hintEnabled
              ? 'Show the AI\'s suggested move'
              : 'Wait for your turn'
        }
      >
        💡 Hint
      </button>
      <button
        type="button"
        className="hud-btn hud-btn-subtle"
        onClick={onOfferDraw}
        disabled={gameOver}
        title={gameOver ? 'Game over' : 'Offer a draw'}
      >
        Offer draw
      </button>
      <button
        type="button"
        className="hud-btn hud-btn-subtle hud-btn-warn"
        onClick={() => {
          if (confirm('Resign this game? Your opponent wins.')) onResign();
        }}
        disabled={gameOver}
        title={gameOver ? 'Game over' : 'Concede the game — opponent wins by resignation'}
      >
        Resign
      </button>
      <span className="game-toolbar-spacer" aria-hidden />
      <label className="game-toolbar-clock" title="Time control for the next new game">
        <span className="game-toolbar-clock-label">Clock</span>
        <select
          className="hud-mode-select game-toolbar-clock-select"
          value={clockOption}
          onChange={(e) => onSetClockOption(e.target.value as ClockOptionId)}
        >
          {CLOCK_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="hud-btn"
        onClick={onNewGame}
      >
        New game
      </button>
    </div>
  );
}
