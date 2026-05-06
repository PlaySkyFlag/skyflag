import { TURN_LIMIT } from './game/constants';
import type { GameState, Player } from './game/types';

const PLAYER_NAME: Record<Player, string> = { p1: 'Slate', p2: 'Ivory' };

const REASON_LABEL: Record<'nexus' | 'elimination' | 'turn-limit', string> = {
  nexus: 'Nexus',
  elimination: 'elimination',
  'turn-limit': 'turn-limit',
};

type Props = {
  state: GameState;
  aiPlayer: Player | null;
  onToggleAi: () => void;
  onEndTurn: () => void;
  onNewGame: () => void;
};

export default function StatusBar({ state, aiPlayer, onToggleAi, onEndTurn, onNewGame }: Props) {
  const aiBtn = (
    <button type="button" className="hud-btn hud-btn-subtle" onClick={onToggleAi}>
      {aiPlayer ? `AI: ${PLAYER_NAME[aiPlayer]}` : 'Hot-seat'}
    </button>
  );

  if (state.status.kind === 'won') {
    return (
      <div className="hud hud-finished">
        <span className={`hud-pip hud-pip-${state.status.winner}`} aria-hidden />
        <span>
          <strong>{PLAYER_NAME[state.status.winner]}</strong> wins by {REASON_LABEL[state.status.reason]}
        </span>
        <button type="button" className="hud-btn" onClick={onNewGame}>New game</button>
        {aiBtn}
      </div>
    );
  }

  if (state.status.kind === 'draw') {
    return (
      <div className="hud hud-finished">
        <span>Draw — {REASON_LABEL[state.status.reason]}</span>
        <button type="button" className="hud-btn" onClick={onNewGame}>New game</button>
        {aiBtn}
      </div>
    );
  }

  const acts = state.activationsRemaining;
  const isAiTurn = aiPlayer === state.currentPlayer;
  return (
    <div className="hud">
      <span className="hud-section">
        <span className={`hud-pip hud-pip-${state.currentPlayer}`} aria-hidden />
        <strong>{PLAYER_NAME[state.currentPlayer]}</strong> {isAiTurn ? 'thinking…' : 'to move'}
      </span>
      <span className="hud-divider">·</span>
      <span className="hud-section">
        {acts} activation{acts === 1 ? '' : 's'} left
      </span>
      <span className="hud-divider">·</span>
      <span className="hud-section">
        Turn {state.turnNumber} / {TURN_LIMIT}
      </span>
      <span className="hud-divider">·</span>
      <button type="button" className="hud-btn" onClick={onEndTurn} disabled={isAiTurn}>End turn</button>
      <button type="button" className="hud-btn hud-btn-subtle" onClick={onNewGame}>New game</button>
      {aiBtn}
    </div>
  );
}
