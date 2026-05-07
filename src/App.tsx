import { useEffect, useReducer, useState } from 'react';
import Board, { type BoardTheme, type DeployCell, type Marker } from './Board';
import Help from './Help';
import PieceTray from './PieceTray';
import StatusBar from './StatusBar';
import { chooseAction } from './game/ai';
import {
  DEPLOY_COORDS,
  FLAG_COORDS,
  LAYER_ORDER,
  LIFT_CELLS,
  NEXUS_COORD,
  createInitialGameState,
} from './game/constants';
import { legalMovesFor, pieceAt, sameCoord } from './game/moves';
import { reduce } from './game/reducer';
import { loadSession, saveSession } from './game/storage';
import type { Coord, GameState, Layer, PieceId, PieceKind, Player } from './game/types';
import './App.css';

const AI_THINK_DELAY_MS = 600;

const SPACE_THEME: BoardTheme = {
  lightFill: '#5b5f9a',
  darkFill: '#3a3d6b',
  background: '#15172e',
  stroke: '#0a0b1c',
  label: '#9ea4cf',
};

const SKY_THEME: BoardTheme = {
  lightFill: '#bcdcef',
  darkFill: '#7eb3d4',
  background: '#2a4860',
  stroke: '#163040',
  label: '#a8c4d8',
};

const GROUND_THEME: BoardTheme = {
  lightFill: '#a8c48f',
  darkFill: '#6b8e5a',
  background: '#1f2a17',
  stroke: '#2d3b25',
  label: '#a4b89a',
};

const LAYER_THEMES: Record<Layer, BoardTheme> = {
  space: SPACE_THEME,
  sky: SKY_THEME,
  ground: GROUND_THEME,
};

const LAYER_NAMES: Record<Layer, string> = {
  space: 'Space / Empyrean',
  sky: 'Sky / Meridian',
  ground: 'Ground / Terran',
};

const PLAYERS: Player[] = ['p1', 'p2'];

const PIECE_SYMBOL: Record<PieceKind, string> = {
  captain: '♚', // ♚ king
  soldier: '♟', // ♟ pawn
  rover:   '♜', // ♜ rook
  pilot:   '♝', // ♝ bishop
};

const flagSymbol = (layer: Layer): string => (layer === 'space' ? '★' : '⚑');

function markersForLayer(layer: Layer, state: GameState): Marker[] {
  const markers: Marker[] = [];

  for (const cell of LIFT_CELLS) {
    markers.push({ row: cell.row, col: cell.col, symbol: '⬆', kind: 'lift' });
  }

  for (const player of PLAYERS) {
    if (!state.flags[layer][player]) {
      const pos = FLAG_COORDS[player][layer];
      markers.push({ row: pos.row, col: pos.col, symbol: flagSymbol(layer), kind: player });
    }
  }

  if (layer === 'space') {
    markers.push({ row: NEXUS_COORD.row, col: NEXUS_COORD.col, symbol: '◎', kind: 'nexus' });
  }

  for (const bp of state.onBoard) {
    if (bp.coord.layer !== layer) continue;
    const badge =
      bp.piece.kind === 'captain' && bp.piece.promotedFromSoldier ? '★' : undefined;
    markers.push({
      row: bp.coord.row,
      col: bp.coord.col,
      symbol: PIECE_SYMBOL[bp.piece.kind],
      kind: bp.piece.owner,
      badge,
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
  | null
  | { kind: 'hand'; pieceId: PieceId }
  | { kind: 'board'; pieceId: PieceId };

// Read once at module load so initial state is hydrated synchronously.
const INITIAL_SESSION = loadSession();

export default function App() {
  const [state, dispatch] = useReducer(
    reduce,
    undefined,
    () => INITIAL_SESSION?.game ?? createInitialGameState(),
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [aiPlayer, setAiPlayer] = useState<Player | null>(
    INITIAL_SESSION?.aiPlayer ?? 'p2',
  );

  // Auto-save on any state or AI-mode change. Selection state is transient
  // and intentionally not persisted.
  useEffect(() => {
    saveSession({ game: state, aiPlayer });
  }, [state, aiPlayer]);

  // Drop selection whenever the active player or game status changes.
  useEffect(() => {
    setSelection(null);
  }, [state.currentPlayer, state.status]);

  // AI loop: when it's the AI's turn and the game is in progress, pick an
  // action and dispatch it after a small visible delay. The effect re-runs
  // after each dispatch (state changes), automatically scheduling the next
  // AI activation. When the turn passes back to the human, currentPlayer
  // no longer matches aiPlayer and the loop stops.
  useEffect(() => {
    if (!aiPlayer) return;
    if (state.status.kind !== 'in-progress') return;
    if (state.currentPlayer !== aiPlayer) return;

    const timer = setTimeout(() => {
      const action = chooseAction(state);
      dispatch(action ?? { type: 'end-turn' });
    }, AI_THINK_DELAY_MS);

    return () => clearTimeout(timer);
  }, [aiPlayer, state]);

  const inProgress = state.status.kind === 'in-progress';
  const isAiTurn = aiPlayer === state.currentPlayer && inProgress;

  const selectedBoardPiece =
    selection?.kind === 'board'
      ? state.onBoard.find((bp) => bp.piece.id === selection.pieceId)
      : undefined;

  const selectedHandId = selection?.kind === 'hand' ? selection.pieceId : null;

  type TargetCell = { row: number; col: number; kind: 'move' | 'lift-up' | 'lift-down' };
  const legalTargetsByLayer: Record<Layer, TargetCell[]> = { ground: [], sky: [], space: [] };
  if (selectedBoardPiece) {
    const sourceLayer = selectedBoardPiece.coord.layer;
    const sourceIdx = LAYER_ORDER.indexOf(sourceLayer);
    for (const c of legalMovesFor(selectedBoardPiece, state)) {
      let kind: 'move' | 'lift-up' | 'lift-down' = 'move';
      if (c.layer !== sourceLayer) {
        // LAYER_ORDER is top-to-bottom (space, sky, ground), so a smaller
        // index means a higher layer.
        kind = LAYER_ORDER.indexOf(c.layer) < sourceIdx ? 'lift-up' : 'lift-down';
      }
      legalTargetsByLayer[c.layer].push({ row: c.row, col: c.col, kind });
    }
  }

  const handleSelectHandPiece = (id: PieceId) => {
    if (isAiTurn) return;
    setSelection((prev) => (prev?.kind === 'hand' && prev.pieceId === id ? null : { kind: 'hand', pieceId: id }));
  };

  const handleDeployClick = (player: Player) => {
    if (!inProgress || isAiTurn) return;
    if (player !== state.currentPlayer) return;
    if (selection?.kind !== 'hand') return;
    dispatch({ type: 'deploy', pieceId: selection.pieceId });
    setSelection(null);
  };

  const handleCellClick = (layer: Layer, row: number, col: number) => {
    if (!inProgress || isAiTurn) return;
    const target: Coord = { layer, row, col };

    // 1. If a board piece is selected and the click is a legal target → move.
    if (selectedBoardPiece) {
      const moves = legalMovesFor(selectedBoardPiece, state);
      if (moves.some((c) => sameCoord(c, target))) {
        dispatch({ type: 'move', pieceId: selectedBoardPiece.piece.id, to: target });
        setSelection(null);
        return;
      }
    }

    // 2. If the clicked cell holds the current player's piece → select it.
    const occupant = pieceAt(state, target);
    if (occupant && occupant.piece.owner === state.currentPlayer) {
      setSelection({ kind: 'board', pieceId: occupant.piece.id });
      return;
    }

    // 3. Otherwise, deselect.
    setSelection(null);
  };

  const activeDeployPlayer: Player | null =
    selection?.kind === 'hand' && inProgress ? state.currentPlayer : null;

  const renderBoard = (layer: Layer) => {
    const selectedCell =
      selectedBoardPiece && selectedBoardPiece.coord.layer === layer
        ? { row: selectedBoardPiece.coord.row, col: selectedBoardPiece.coord.col }
        : null;
    return (
      <Board
        key={layer}
        name={LAYER_NAMES[layer]}
        theme={LAYER_THEMES[layer]}
        markers={markersForLayer(layer, state)}
        deployCells={deployCellsForLayer(layer)}
        activeDeployPlayer={layer === 'ground' ? activeDeployPlayer : null}
        onDeployCellClick={layer === 'ground' ? handleDeployClick : undefined}
        selectedCell={selectedCell}
        legalTargets={legalTargetsByLayer[layer]}
        onCellClick={(row, col) => handleCellClick(layer, row, col)}
      />
    );
  };

  return (
    <main className="app">
      <h1>SkyFlag</h1>
      <StatusBar
        state={state}
        aiPlayer={aiPlayer}
        onSetMode={setAiPlayer}
        onEndTurn={() => dispatch({ type: 'end-turn' })}
        onNewGame={() => dispatch({ type: 'new-game' })}
      />
      <Help />
      {renderBoard('space')}
      {renderBoard('sky')}
      <PieceTray
        player="p1"
        pieces={state.inHand.p1}
        capturedPieces={state.captured.p1}
        isInteractive={inProgress && state.currentPlayer === 'p1' && aiPlayer !== 'p1'}
        selectedId={selectedHandId}
        onSelect={handleSelectHandPiece}
      />
      {renderBoard('ground')}
      <PieceTray
        player="p2"
        pieces={state.inHand.p2}
        capturedPieces={state.captured.p2}
        isInteractive={inProgress && state.currentPlayer === 'p2' && aiPlayer !== 'p2'}
        selectedId={selectedHandId}
        onSelect={handleSelectHandPiece}
      />
    </main>
  );
}
