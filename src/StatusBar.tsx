import { useState } from 'react';
import { TURN_LIMIT } from './game/constants';
import { isMuted, setMuted } from './game/sound';
import type { GameState, Player } from './game/types';

const PLAYER_NAME: Record<Player, string> = { p1: 'Slate', p2: 'Ivory' };

const REASON_LABEL: Record<'nexus' | 'elimination' | 'turn-limit', string> = {
  nexus: 'Nexus',
  elimination: 'elimination',
  'turn-limit': 'turn-limit',
};

type Mode = Player | null;

type Props = {
  state: GameState;
  aiPlayer: Player | null;
  onSetMode: (mode: Mode) => void;
  onEndTurn: () => void;
  onNewGame: () => void;
};

// Dropdown value strings map cleanly to/from the aiPlayer slot. Keeping
// the same Slate/Ivory/2P labels the segmented control had.
const SELECT_TO_MODE: Record<string, Mode> = {
  'p2': 'p2',   // 1P · Slate — you are Slate, AI plays Ivory (p2)
  'p1': 'p1',   // 1P · Ivory — you are Ivory, AI plays Slate (p1)
  'none': null, // 2P hot-seat — no AI
};

export default function StatusBar({ state, aiPlayer, onSetMode, onEndTurn, onNewGame }: Props) {
  const [mutedNow, setMutedNow] = useState(isMuted());
  const muteControl = (
    <button
      type="button"
      className="hud-btn hud-btn-subtle hud-mute-btn"
      aria-label={mutedNow ? 'Unmute sounds' : 'Mute sounds'}
      title={mutedNow ? 'Unmute' : 'Mute'}
      onClick={() => {
        const next = !mutedNow;
        setMuted(next);
        setMutedNow(next);
      }}
    >
      {mutedNow ? '🔇' : '🔊'}
    </button>
  );

  const modeControl = (
    <select
      className="hud-mode-select"
      value={aiPlayer ?? 'none'}
      onChange={(e) => onSetMode(SELECT_TO_MODE[e.target.value])}
      aria-label="Players"
      title="Choose 1-player or 2-player mode"
    >
      <option value="p2">1P · Slate</option>
      <option value="p1">1P · Ivory</option>
      <option value="none">2P</option>
    </select>
  );

  if (state.status.kind === 'won') {
    return (
      <div className="hud hud-finished">
        <span className={`hud-pip hud-pip-${state.status.winner}`} aria-hidden />
        <span>
          <strong>{PLAYER_NAME[state.status.winner]}</strong> wins by {REASON_LABEL[state.status.reason]}
        </span>
        <button type="button" className="hud-btn" onClick={onNewGame}>New game</button>
        {modeControl}
        {muteControl}
      </div>
    );
  }

  if (state.status.kind === 'draw') {
    return (
      <div className="hud hud-finished">
        <span>Draw — {REASON_LABEL[state.status.reason]}</span>
        <button type="button" className="hud-btn" onClick={onNewGame}>New game</button>
        {modeControl}
        {muteControl}
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
        <span className="hud-divider">·</span>
        <button type="button" className="hud-btn" onClick={onEndTurn} disabled={isAiTurn}>End turn</button>
        <button type="button" className="hud-btn hud-btn-subtle" onClick={onNewGame}>New game</button>
        {modeControl}
      </div>
    </>
  );
}
