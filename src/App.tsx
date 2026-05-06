import { useState } from 'react';
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
import type { GameState, Layer, PieceKind, Player } from './game/types';
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

const renderBoard = (layer: Layer, state: GameState) => (
  <Board
    key={layer}
    name={LAYER_NAMES[layer]}
    theme={LAYER_THEMES[layer]}
    markers={markersForLayer(layer, state)}
    deployCells={deployCellsForLayer(layer)}
  />
);

export default function App() {
  const [state] = useState(createInitialGameState);

  return (
    <main className="app">
      <h1>SkyFlag</h1>
      <StatusBar state={state} />
      {renderBoard('space', state)}
      {renderBoard('sky', state)}
      <PieceTray player="p1" pieces={state.inHand.p1} />
      {renderBoard('ground', state)}
      <PieceTray player="p2" pieces={state.inHand.p2} />
    </main>
  );
}
