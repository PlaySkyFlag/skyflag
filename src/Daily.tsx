// Daily puzzle modal. One self-contained position per day; the user
// makes a single move and gets feedback on whether it matches the
// AI's best pick at depth 3. Lives outside the regular game state so
// playing the puzzle never disturbs an in-progress local game.

import { useEffect, useMemo, useReducer, useState } from 'react';
import Board, { type BoardTheme, type DeployCell, type Marker } from './Board';
import {
  DEPLOY_COORDS,
  FLAG_COORDS,
  LIFT_CELLS,
  LAYER_ORDER,
  NEXUS_COORD,
} from './game/constants';
import { generateDailyPuzzle, isPuzzleSolved } from './game/dailyPuzzle';
import { legalMovesFor, pieceAt, sameCoord } from './game/moves';
import { reduce, type Action } from './game/reducer';
import { THEMES, type ThemeId } from './game/themes';
import type {
  Coord,
  GameState,
  Layer,
  PieceId,
  PieceKind,
  Player,
} from './game/types';

const PLAYER_NAME: Record<Player, string> = {
  p1: 'Grey Ravens',
  p2: 'White Stags',
};

const PIECE_SYMBOL: Record<PieceKind, string> = {
  captain: '♚',
  soldier: '♟',
  rover: '♜',
  pilot: '♝',
};

const PLAYERS: Player[] = ['p1', 'p2'];

const LAYER_NAMES: Record<Layer, string> = {
  space: 'Space',
  sky: 'Sky',
  ground: 'Ground',
};

// Same shape as App's helpers; copied inline so Daily is self-contained
// and a future refactor can pull both into a shared module.
function layerThemesFor(themeId: ThemeId): Record<Layer, BoardTheme> {
  const t = THEMES[themeId].layers;
  return {
    space: { ...t.space, kind: 'space' },
    sky: { ...t.sky, kind: 'sky' },
    ground: { ...t.ground, kind: 'ground' },
  };
}

function markersForLayer(layer: Layer, state: GameState): Marker[] {
  const markers: Marker[] = [];
  for (const cell of LIFT_CELLS) {
    markers.push({ row: cell.row, col: cell.col, symbol: '⬆', kind: 'lift' });
  }
  for (const player of PLAYERS) {
    if (!state.flags[layer][player]) {
      const pos = FLAG_COORDS[player][layer];
      markers.push({ row: pos.row, col: pos.col, symbol: '⚑', kind: player });
    }
  }
  if (layer === 'space') {
    markers.push({
      row: NEXUS_COORD.row,
      col: NEXUS_COORD.col,
      symbol: '◎',
      kind: 'nexus',
    });
  }
  for (const bp of state.onBoard) {
    if (bp.coord.layer !== layer) continue;
    markers.push({
      row: bp.coord.row,
      col: bp.coord.col,
      symbol: PIECE_SYMBOL[bp.piece.kind],
      kind: bp.piece.owner,
      id: bp.piece.id,
    });
  }
  return markers;
}

function deployCellsForLayer(layer: Layer): DeployCell[] {
  if (layer !== 'ground') return [];
  return PLAYERS.map((player) => ({
    row: DEPLOY_COORDS[player].row,
    col: DEPLOY_COORDS[player].col,
    player,
  }));
}

type Selection =
  | { kind: 'hand'; pieceId: PieceId }
  | { kind: 'board'; pieceId: PieceId }
  | null;

type Props = {
  open: boolean;
  onClose: () => void;
  themeId: ThemeId;
};

export default function Daily({ open, onClose, themeId }: Props) {
  // Generate the puzzle once per open. Same date in → same puzzle out
  // (per dailyPuzzle.ts) so closing and re-opening shows the same
  // position; new day produces a new puzzle.
  const puzzle = useMemo(() => (open ? generateDailyPuzzle() : null), [open]);

  // Local state for the puzzle position. Independent of the main game's
  // useReducer so playing the puzzle never overwrites a saved game.
  const initial = puzzle?.state ?? null;
  const [state, dispatch] = useReducer(
    reduce,
    initial ?? ({} as GameState),
    (s) => s,
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [feedback, setFeedback] = useState<
    | { kind: 'solved' }
    | { kind: 'wrong'; bestAction: Action }
    | null
  >(null);
  // Two-phase modal: 'briefing' shows the objective + a quick rules
  // recap before revealing the position; 'playing' is the actual puzzle
  // interaction. Mirrors the chess.com / Lichess pattern of giving the
  // user a deliberate "I'm ready" beat — especially helpful in Skyflag
  // since the rules are less universal than chess.
  const [phase, setPhase] = useState<'briefing' | 'playing'>('briefing');

  // Whenever the puzzle key changes (open/close cycles or rare
  // mid-day rollover), reset to the puzzle's starting position and
  // back to the briefing phase.
  useEffect(() => {
    if (!puzzle) return;
    dispatch({ type: 'remote-sync', state: puzzle.state });
    setSelection(null);
    setFeedback(null);
    setPhase('briefing');
  }, [puzzle]);

  if (!open || !puzzle) return null;

  // useReducer's initial value is locked at mount time. Daily is mounted
  // with open=false (puzzle null → empty-object placeholder), so on the
  // first render after the user opens it, `state` is still `{}` while
  // `puzzle` has just been computed. The remote-sync useEffect runs
  // AFTER this render, leaving a one-tick window where any access to
  // state.inHand / state.onBoard etc. crashes ("reading 'undefined'").
  // Bail this render; the effect fires next, and the second render
  // shows the modal correctly.
  if (!state.onBoard || !state.inHand) return null;

  const layerThemes = layerThemesFor(themeId);

  const selectedBoardPiece =
    selection?.kind === 'board'
      ? state.onBoard.find((b) => b.piece.id === selection.pieceId) ?? null
      : null;

  const legalTargetsByLayer: Record<Layer, ReadonlyArray<{ row: number; col: number }>> = {
    space: [],
    sky: [],
    ground: [],
  };
  if (selectedBoardPiece) {
    for (const t of legalMovesFor(selectedBoardPiece, state)) {
      legalTargetsByLayer[t.layer] = [
        ...legalTargetsByLayer[t.layer],
        { row: t.row, col: t.col },
      ];
    }
  }

  const recordAction = (action: Action) => {
    if (feedback) return; // already evaluated; freeze further input
    dispatch(action);
    if (isPuzzleSolved(puzzle.bestAction, action)) {
      setFeedback({ kind: 'solved' });
    } else {
      setFeedback({ kind: 'wrong', bestAction: puzzle.bestAction });
    }
  };

  const handleCellClick = (layer: Layer, row: number, col: number) => {
    if (feedback) return;
    const target: Coord = { layer, row, col };
    if (selectedBoardPiece) {
      const moves = legalMovesFor(selectedBoardPiece, state);
      if (moves.some((c) => sameCoord(c, target))) {
        recordAction({
          type: 'move',
          pieceId: selectedBoardPiece.piece.id,
          to: target,
        });
        setSelection(null);
        return;
      }
    }
    const occupant = pieceAt(state, target);
    if (occupant && occupant.piece.owner === state.currentPlayer) {
      setSelection({ kind: 'board', pieceId: occupant.piece.id });
      return;
    }
    setSelection(null);
  };

  const handleDeployClick = (player: Player) => {
    if (feedback) return;
    if (selection?.kind !== 'hand') return;
    if (player !== state.currentPlayer) return;
    if (pieceAt(state, DEPLOY_COORDS[player]) !== undefined) return;
    recordAction({ type: 'deploy', pieceId: selection.pieceId });
    setSelection(null);
  };

  // Selected hand piece should activate the current player's deploy pad.
  const activeDeployPlayer: Player | null =
    selection?.kind === 'hand' &&
    pieceAt(state, DEPLOY_COORDS[state.currentPlayer]) === undefined
      ? state.currentPlayer
      : null;

  // Format the answer for display when the player got it wrong.
  const describeAction = (action: Action): string => {
    if (action.type === 'move') {
      const bp = state.onBoard.find((b) => b.piece.id === action.pieceId);
      const piece = bp ? PIECE_SYMBOL[bp.piece.kind] : '?';
      const fromTxt = bp
        ? ` from ${LAYER_NAMES[bp.coord.layer]}(r${bp.coord.row},c${bp.coord.col})`
        : '';
      const to = action.to;
      return `${piece}${fromTxt} → ${LAYER_NAMES[to.layer]}(r${to.row},c${to.col})`;
    }
    if (action.type === 'deploy') {
      const handPiece = state.inHand[state.currentPlayer].find(
        (p) => p.id === action.pieceId,
      );
      const glyph = handPiece ? PIECE_SYMBOL[handPiece.kind] : '?';
      return `Deploy ${glyph}`;
    }
    return action.type;
  };

  return (
    <div className="daily-overlay" role="dialog" aria-modal="true">
      <div className="daily-card">
        <div className="daily-header">
          <h2 className="daily-title">
            Daily puzzle <span className="daily-date">{puzzle.dateKey}</span>
          </h2>
          <button
            type="button"
            className="account-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {phase === 'briefing' ? (
          <div className="daily-briefing">
            <p className="daily-briefing-lead">
              Today's puzzle is set on a real mid-game position. Find the
              best move for{' '}
              <strong>{PLAYER_NAME[state.currentPlayer]}</strong>. One
              attempt — make it count.
            </p>
            <div className="daily-briefing-tips">
              <h3>Quick reminders</h3>
              <ul>
                <li>Captains capture flags by landing on the flag square.</li>
                <li>Soldiers promote to Captains on the opponent's back row.</li>
                <li>Lifts (corner squares on each layer) move pieces between layers — costs 2 activations.</li>
                <li>Pilots can leap diagonally and capture jumped opponents.</li>
              </ul>
            </div>
            <div className="daily-briefing-actions">
              <button
                type="button"
                className="end-game-btn end-game-btn--subtle"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="end-game-btn"
                onClick={() => setPhase('playing')}
              >
                Begin puzzle
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="daily-prompt">
              Find the best move for{' '}
              <strong>{PLAYER_NAME[state.currentPlayer]}</strong>.
              {state.inHand[state.currentPlayer].length > 0 &&
                ' (Or the best deploy.)'}
            </p>

            <div className="daily-boards">
              {LAYER_ORDER.map((layer) => (
                <Board
                  key={layer}
                  theme={layerThemes[layer]}
                  markers={markersForLayer(layer, state)}
                  deployCells={deployCellsForLayer(layer)}
                  activeDeployPlayer={layer === 'ground' ? activeDeployPlayer : null}
                  onDeployCellClick={layer === 'ground' ? handleDeployClick : undefined}
                  selectedCell={
                    selectedBoardPiece && selectedBoardPiece.coord.layer === layer
                      ? {
                          row: selectedBoardPiece.coord.row,
                          col: selectedBoardPiece.coord.col,
                        }
                      : null
                  }
                  legalTargets={legalTargetsByLayer[layer]}
                  onCellClick={(row, col) => handleCellClick(layer, row, col)}
                />
              ))}
            </div>

            {feedback && (
              <div
                className={`daily-result daily-result-${feedback.kind === 'solved' ? 'good' : 'bad'}`}
              >
                {feedback.kind === 'solved' ? (
                  <>
                    <strong>★ Solved!</strong> You found today's best move.
                  </>
                ) : (
                  <>
                    <strong>Not the best move.</strong> The AI's pick:{' '}
                    <em>{describeAction(feedback.bestAction)}</em>
                  </>
                )}
              </div>
            )}

            <div className="daily-actions">
              <button type="button" className="end-game-btn" onClick={onClose}>
                {feedback ? 'Done' : 'Close'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
