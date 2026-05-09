import { useState } from 'react';
import { TURN_LIMIT } from './game/constants';
import { isMuted, setMuted } from './game/sound';
import type { Difficulty } from './game/storage';
import type { GameState, Player } from './game/types';

const PLAYER_NAME: Record<Player, string> = { p1: 'Grey Ravens', p2: 'White Stags' };

const REASON_LABEL: Record<
  'nexus' | 'elimination' | 'resignation' | 'turn-limit' | 'stalemate' | 'agreement',
  string
> = {
  nexus: 'Nexus',
  elimination: 'elimination',
  resignation: 'resignation',
  'turn-limit': 'turn-limit',
  stalemate: 'stalemate',
  agreement: 'agreement',
};

type Mode = Player | null;

type Props = {
  state: GameState;
  aiPlayer: Player | null;
  onSetMode: (mode: Mode) => void;
  difficulty: Difficulty;
  onSetDifficulty: (d: Difficulty) => void;
  onNewGame: () => void;
  onResign: () => void;
  onOfferDraw: () => void;
  // Asks App to compute the AI's suggested move and highlight it on
  // the board. App owns hint state because it spans across all three
  // boards via the per-layer Board props.
  onRequestHint: () => void;
  // Disables the Hint button when it's the AI's turn or the local user
  // isn't the side to move (MP).
  hintEnabled: boolean;
};

// Dropdown value strings map cleanly to/from the aiPlayer slot. The
// option keys are the AI's player slot, so 'p2' means "AI plays Stags".
const SELECT_TO_MODE: Record<string, Mode> = {
  'p2': 'p2',   // 1P · Ravens — you are Ravens (p1), AI plays Stags (p2)
  'p1': 'p1',   // 1P · Stags  — you are Stags (p2), AI plays Ravens (p1)
  'none': null, // 2P hot-seat — no AI
};

export default function StatusBar({
  state,
  aiPlayer,
  onSetMode,
  difficulty,
  onSetDifficulty,
  onNewGame,
  onResign,
  onOfferDraw,
  onRequestHint,
  hintEnabled,
}: Props) {
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
      <option value="p2">1P · Ravens</option>
      <option value="p1">1P · Stags</option>
      <option value="none">2P</option>
    </select>
  );

  // Difficulty selector — only meaningful in 1P modes (where the AI is
  // actually playing). Disabled in 2P so it can't be changed accidentally.
  const difficultyControl = (
    <select
      className="hud-mode-select"
      value={difficulty}
      onChange={(e) => onSetDifficulty(e.target.value as Difficulty)}
      aria-label="AI difficulty"
      title="AI difficulty (search depth)"
      disabled={aiPlayer === null}
    >
      <option value="easy">AI Easy</option>
      <option value="medium">AI Medium</option>
      <option value="hard">AI Hard</option>
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
        {difficultyControl}
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
        {difficultyControl}
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
        <button
          type="button"
          className="hud-btn hud-btn-subtle"
          onClick={onRequestHint}
          disabled={!hintEnabled}
          title={hintEnabled ? 'Show the AI\'s suggested move' : 'Wait for your turn'}
        >
          Hint
        </button>
        <button
          type="button"
          className="hud-btn hud-btn-subtle"
          onClick={onOfferDraw}
          title="Offer a draw"
        >
          Offer draw
        </button>
        <button
          type="button"
          className="hud-btn hud-btn-subtle hud-btn-warn"
          onClick={() => {
            if (confirm('Resign this game? Your opponent wins.')) onResign();
          }}
          title="Concede the game — opponent wins by resignation"
        >
          Resign
        </button>
        <button type="button" className="hud-btn hud-btn-subtle" onClick={onNewGame}>New game</button>
        {modeControl}
        {difficultyControl}
      </div>
    </>
  );
}
