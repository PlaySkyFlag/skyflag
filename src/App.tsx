import Board, { type BoardTheme } from './Board';
import './App.css';

const SPACE_THEME: BoardTheme = {
  lightFill: '#5b5f9a',
  darkFill: '#3a3d6b',
  background: '#15172e',
  stroke: '#0a0b1c',
};

const SKY_THEME: BoardTheme = {
  lightFill: '#bcdcef',
  darkFill: '#7eb3d4',
  background: '#2a4860',
  stroke: '#163040',
};

const GROUND_THEME: BoardTheme = {
  lightFill: '#a8c48f',
  darkFill: '#6b8e5a',
  background: '#1f2a17',
  stroke: '#2d3b25',
};

export default function App() {
  return (
    <main className="app">
      <h1>SkyFlag</h1>
      <div className="boards">
        <Board name="Space / Empyrean" theme={SPACE_THEME} />
        <Board name="Sky / Meridian" theme={SKY_THEME} />
        <Board name="Ground / Terran" theme={GROUND_THEME} />
      </div>
    </main>
  );
}
