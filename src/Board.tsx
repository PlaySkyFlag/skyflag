const BOARD_SIZE = 6;
const CELL = 56;
const PADDING = 14;
const LABEL_GUTTER = 20;
const ORIGIN_X = PADDING + LABEL_GUTTER;
const ORIGIN_Y = PADDING + LABEL_GUTTER;
const SVG_WIDTH = ORIGIN_X + BOARD_SIZE * CELL + PADDING;
const SVG_HEIGHT = ORIGIN_Y + BOARD_SIZE * CELL + PADDING;

export type BoardTheme = {
  lightFill: string;
  darkFill: string;
  background: string;
  stroke: string;
  label: string;
};

import type { Player } from './game/types';

export type MarkerKind = 'lift' | 'nexus' | Player;

export type Marker = {
  row: number;
  col: number;
  symbol: string;
  kind: MarkerKind;
};

export type DeployCell = {
  row: number;
  col: number;
  player: Player;
};

const MARKER_STYLE: Record<MarkerKind, { fill: string; stroke: string; strokeWidth: number }> = {
  lift:  { fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 0.6 },
  nexus: { fill: '#f5c343', stroke: '#1a1a1a', strokeWidth: 0.8 },
  p1:    { fill: '#1a2540', stroke: '#e8e8e8', strokeWidth: 0.8 },
  p2:    { fill: '#f5e8d0', stroke: '#1a1a1a', strokeWidth: 0.8 },
};

const DEPLOY_STYLE: Record<Player, { stroke: string; fill: string }> = {
  p1: { stroke: '#a8b8d8', fill: 'rgba(168,184,216,0.14)' },
  p2: { stroke: '#f5e8d0', fill: 'rgba(245,232,208,0.14)' },
};

type BoardProps = {
  name: string;
  theme: BoardTheme;
  markers?: Marker[];
  deployCells?: DeployCell[];
};

export default function Board({ name, theme, markers = [], deployCells = [] }: BoardProps) {
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const isDark = (row + col) % 2 === 1;
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={ORIGIN_X + col * CELL}
          y={ORIGIN_Y + row * CELL}
          width={CELL}
          height={CELL}
          fill={isDark ? theme.darkFill : theme.lightFill}
          stroke={theme.stroke}
          strokeWidth={1}
        />
      );
    }
  }

  const colLabels = [];
  for (let col = 0; col < BOARD_SIZE; col++) {
    colLabels.push(
      <text
        key={`c-${col}`}
        x={ORIGIN_X + col * CELL + CELL / 2}
        y={ORIGIN_Y - LABEL_GUTTER / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontFamily="system-ui, sans-serif"
        fill={theme.label}
        style={{ userSelect: 'none' }}
      >
        {`c${col}`}
      </text>
    );
  }

  const rowLabels = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    rowLabels.push(
      <text
        key={`r-${row}`}
        x={ORIGIN_X - LABEL_GUTTER / 2}
        y={ORIGIN_Y + row * CELL + CELL / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontFamily="system-ui, sans-serif"
        fill={theme.label}
        style={{ userSelect: 'none' }}
      >
        {`r${row}`}
      </text>
    );
  }

  const deployEls = deployCells.map((d) => {
    const style = DEPLOY_STYLE[d.player];
    const inset = 4;
    return (
      <rect
        key={`d-${d.player}-${d.row}-${d.col}`}
        x={ORIGIN_X + d.col * CELL + inset}
        y={ORIGIN_Y + d.row * CELL + inset}
        width={CELL - inset * 2}
        height={CELL - inset * 2}
        rx={6}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
    );
  });

  const markerEls = markers.map((m) => {
    const style = MARKER_STYLE[m.kind];
    return (
      <text
        key={`m-${m.row}-${m.col}-${m.symbol}`}
        x={ORIGIN_X + m.col * CELL + CELL / 2}
        y={ORIGIN_Y + m.row * CELL + CELL / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={CELL * 0.6}
        fontFamily="system-ui, sans-serif"
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        paintOrder="stroke"
        style={{ userSelect: 'none' }}
      >
        {m.symbol}
      </text>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <h2 style={{ margin: 0, fontFamily: 'system-ui, sans-serif', fontSize: '1.05rem' }}>
        {name}
      </h2>
      <svg
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        style={{ background: theme.background, borderRadius: 8 }}
      >
        {cells}
        {colLabels}
        {rowLabels}
        {deployEls}
        {markerEls}
      </svg>
    </div>
  );
}
