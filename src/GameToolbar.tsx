// Thin row of game-context actions, pinned just above the boards.
// Mirrors the layout chess.com / lichess use — Resign / Draw / Hint /
// New game live next to the play surface, separated from app-level
// settings (which sit behind the gear icon in the header).

type Props = {
  onRequestHint: () => void;
  hintEnabled: boolean;
  onOfferDraw: () => void;
  onResign: () => void;
  onNewGame: () => void;
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
