import { TURN_LIMIT } from './game/constants';
import type { GameState, Player } from './game/types';

const PLAYER_NAME: Record<Player, string> = { p1: 'Slate', p2: 'Ivory' };

const REASON_LABEL: Record<'nexus' | 'elimination' | 'turn-limit', string> = {
  nexus: 'Nexus',
  elimination: 'elimination',
  'turn-limit': 'turn-limit',
};

type Props = { state: GameState };

export default function StatusBar({ state }: Props) {
  if (state.status.kind === 'won') {
    return (
      <div className="hud hud-finished">
        <span className={`hud-pip hud-pip-${state.status.winner}`} aria-hidden />
        <span><strong>{PLAYER_NAME[state.status.winner]}</strong> wins by {REASON_LABEL[state.status.reason]}</span>
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
  return (
    <div className="hud">
      <span className="hud-section">
        <span className={`hud-pip hud-pip-${state.currentPlayer}`} aria-hidden />
        <strong>{PLAYER_NAME[state.currentPlayer]}</strong> to move
      </span>
      <span className="hud-divider">·</span>
      <span className="hud-section">
        {acts} activation{acts === 1 ? '' : 's'} left
      </span>
      <span className="hud-divider">·</span>
      <span className="hud-section">
        Turn {state.turnNumber} / {TURN_LIMIT}
      </span>
    </div>
  );
}
