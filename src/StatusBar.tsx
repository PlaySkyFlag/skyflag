import { TURN_LIMIT } from './game/constants';
import type { GameState, GameStatus, Player } from './game/types';

const PLAYER_NAME: Record<Player, string> = { p1: 'Grey Ravens', p2: 'White Stags' };

// Derive reason keys directly from GameStatus so adding a new terminal
// reason in types.ts trips a type error here instead of silently
// rendering as undefined.
type WonReason = Extract<GameStatus, { kind: 'won' }>['reason'];
type DrawReason = Extract<GameStatus, { kind: 'draw' }>['reason'];

const REASON_LABEL: Record<WonReason | DrawReason, string> = {
  nexus: 'Nexus',
  elimination: 'elimination',
  resignation: 'resignation',
  'turn-limit': 'turn-limit',
  stalemate: 'stalemate',
  agreement: 'agreement',
};

type Props = {
  state: GameState;
  aiPlayer: Player | null;
};

// State-only HUD — current player + verb + activations + turn count, or
// the result line when the game is over. All buttons (Hint, Offer draw,
// Resign, New game) live in GameToolbar, and pickers (mode, difficulty,
// theme, sound) live in SettingsMenu.
export default function StatusBar({ state, aiPlayer }: Props) {
  if (state.status.kind === 'won') {
    return (
      <div className="hud hud-finished">
        <span className={`hud-pip hud-pip-${state.status.winner}`} aria-hidden />
        <span>
          <strong>{PLAYER_NAME[state.status.winner]}</strong> wins by {REASON_LABEL[state.status.reason]}
        </span>
      </div>
    );
  }

  if (state.status.kind === 'draw') {
    return (
      <div className="hud hud-finished">
        <span>Draw — {REASON_LABEL[state.status.reason]}</span>
      </div>
    );
  }

  const acts = state.activationsRemaining;
  const isAiTurn = aiPlayer === state.currentPlayer;
  return (
    <>
      <div className="hud-current">
        <span className={`hud-pip hud-pip-${state.currentPlayer}`} aria-hidden />
        <strong>{PLAYER_NAME[state.currentPlayer]}</strong>
        <span className="hud-current-verb">{isAiTurn ? 'thinking…' : 'to move'}</span>
      </div>
      <div className="hud">
        <span className="hud-section">
          {acts} activation{acts === 1 ? '' : 's'} left
        </span>
        <span className="hud-divider">·</span>
        <span className="hud-section">
          Turn {state.turnNumber} / {TURN_LIMIT}
        </span>
      </div>
    </>
  );
}
