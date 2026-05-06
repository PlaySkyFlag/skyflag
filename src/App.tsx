import Board, { type BoardTheme, type DeployCell, type Marker } from './Board';
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

const LIFT_CELLS: Array<[number, number]> = [
  [1, 1], [1, 4], [4, 1], [4, 4],
];

const liftMarkers: Marker[] = LIFT_CELLS.map(([row, col]) => ({
  row, col, symbol: '⬆', kind: 'lift' as const,
}));

const GROUND_MARKERS: Marker[] = [
  ...liftMarkers,
  { row: 0, col: 0, symbol: '⚑', kind: 'p1' },
  { row: 5, col: 5, symbol: '⚑', kind: 'p2' },
];

const GROUND_DEPLOY_CELLS: DeployCell[] = [
  { row: 0, col: 3, player: 'p1' },
  { row: 5, col: 2, player: 'p2' },
];

const SKY_MARKERS: Marker[] = [
  ...liftMarkers,
  { row: 0, col: 5, symbol: '⚑', kind: 'p1' },
  { row: 5, col: 0, symbol: '⚑', kind: 'p2' },
];

const SPACE_MARKERS: Marker[] = [
  ...liftMarkers,
  { row: 0, col: 0, symbol: '★', kind: 'p1' },
  { row: 5, col: 5, symbol: '★', kind: 'p2' },
  { row: 3, col: 3, symbol: '◎', kind: 'nexus' },
];

export default function App() {
  return (
    <main className="app">
      <h1>SkyFlag</h1>
      <div className="boards">
        <Board name="Space / Empyrean" theme={SPACE_THEME} markers={SPACE_MARKERS} />
        <Board name="Sky / Meridian" theme={SKY_THEME} markers={SKY_MARKERS} />
        <Board
          name="Ground / Terran"
          theme={GROUND_THEME}
          markers={GROUND_MARKERS}
          deployCells={GROUND_DEPLOY_CELLS}
        />
      </div>
    </main>
  );
}
