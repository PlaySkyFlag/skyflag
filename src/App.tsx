import { useEffect, useReducer, useState } from 'react';
import Board, { type BoardTheme, type DeployCell, type Marker } from './Board';
import PieceTray from './PieceTray';
import StatusBar from './StatusBar';
import {
  DEPLOY_COORDS,
  FLAG_COORDS,
  LIFT_CELLS,
  NEXUS_COORD,
  createInitialGameState,
} from './game/constants';
import { legalMovesFor, pieceAt, sameCoord } from './game/moves';
import { reduce } from './game/reducer';
import type { Coord, GameState, Layer, PieceId, PieceKind, Player } from './game/types';
import './App.css';

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
  captain: 'C',
  soldier: 'S',
  rover: 'R',
  pilot: 'P',
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
    markers.push({
      row: bp.coord.row,
      col: bp.coord.col,
      symbol: PIECE_SYMBOL[bp.piece.kind],
      kind: bp.piece.owner,
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

export default function App() {
  const [state, dispatch] = useReducer(reduce, undefined, createInitialGameState);
  const [selection, setSelection] = useState<Selection>(null);

  // Drop selection whenever the active player or game status changes.
  useEffect(() => {
    setSelection(null);
  }, [state.currentPlayer, state.status]);

  const inProgress = state.status.kind === 'in-progress';

  const selectedBoardPiece =
    selection?.kind === 'board'
      ? state.onBoard.find((bp) => bp.piece.id === selection.pieceId)
      : undefined;

  const selectedHandId = selection?.kind === 'hand' ? selection.pieceId : null;

  const legalTargetsByLayer: Record<Layer, Coord[]> = { ground: [], sky: [], space: [] };
  if (selectedBoardPiece) {
    for (const c of legalMovesFor(selectedBoardPiece, state)) {
      legalTargetsByLayer[c.layer].push(c);
    }
  }

  const handleSelectHandPiece = (id: PieceId) => {
    setSelection((prev) => (prev?.kind === 'hand' && prev.pieceId === id ? null : { kind: 'hand', pieceId: id }));
  };

  const handleDeployClick = (player: Player) => {
    if (!inProgress) return;
    if (player !== state.currentPlayer) return;
    if (selection?.kind !== 'hand') return;
    dispatch({ type: 'deploy', pieceId: selection.pieceId });
    setSelection(null);
  };

  const handleCellClick = (layer: Layer, row: number, col: number) => {
    if (!inProgress) return;
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
        onEndTurn={() => dispatch({ type: 'end-turn' })}
        onNewGame={() => dispatch({ type: 'new-game' })}
      />
      {renderBoard('space')}
      {renderBoard('sky')}
      <PieceTray
        player="p1"
        pieces={state.inHand.p1}
        isInteractive={inProgress && state.currentPlayer === 'p1'}
        selectedId={selectedHandId}
        onSelect={handleSelectHandPiece}
      />
      {renderBoard('ground')}
      <PieceTray
        player="p2"
        pieces={state.inHand.p2}
        isInteractive={inProgress && state.currentPlayer === 'p2'}
        selectedId={selectedHandId}
        onSelect={handleSelectHandPiece}
      />
    </main>
  );
}
