import { TURN_LIMIT } from './game/constants';
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

const MODE_OPTIONS: ReadonlyArray<{
  mode: Mode;
  label: string;
  pip: 'p1' | 'p2' | null;
  title: string;
}> = [
  { mode: 'p2', label: '1P · Slate',  pip: 'p1', title: 'You play Slate. AI plays Ivory.' },
  { mode: 'p1', label: '1P · Ivory',  pip: 'p2', title: 'You play Ivory. AI plays Slate.' },
  { mode: null, label: '2P',          pip: null, title: 'Two humans on one machine (hot-seat).' },
];

export default function StatusBar({ state, aiPlayer, onSetMode, onEndTurn, onNewGame }: Props) {
  const modeControl = (
    <div className="hud-mode" role="radiogroup" aria-label="Players">
      {MODE_OPTIONS.map((opt) => {
        const active = opt.mode === aiPlayer;
        return (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={active}
            className={`hud-mode-btn${active ? ' is-active' : ''}`}
            onClick={() => onSetMode(opt.mode)}
            title={opt.title}
          >
            {opt.pip && <span className={`hud-pip hud-pip-${opt.pip}`} aria-hidden />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
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
      </div>
    );
  }

  if (state.status.kind === 'draw') {
    return (
      <div className="hud hud-finished">
        <span>Draw — {REASON_LABEL[state.status.reason]}</span>
        <button type="button" className="hud-btn" onClick={onNewGame}>New game</button>
        {modeControl}
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
