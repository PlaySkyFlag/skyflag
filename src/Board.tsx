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
  // Optional small glyph painted in the top-right corner of the cell.
  // Used today for the promoted-Soldier indicator (★).
  badge?: string;
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

const DEPLOY_STYLE: Record<Player, { stroke: string; fill: string; activeFill: string }> = {
  p1: { stroke: '#a8b8d8', fill: 'rgba(168,184,216,0.14)', activeFill: 'rgba(168,184,216,0.32)' },
  p2: { stroke: '#f5e8d0', fill: 'rgba(245,232,208,0.14)', activeFill: 'rgba(245,232,208,0.32)' },
};

type CellRef = { row: number; col: number };

type BoardProps = {
  name: string;
  theme: BoardTheme;
  markers?: Marker[];
  deployCells?: DeployCell[];
  // When set, the deploy cell for this player is highlighted as an active drop target.
  activeDeployPlayer?: Player | null;
  onDeployCellClick?: (player: Player) => void;
  // Selection / movement support.
  selectedCell?: CellRef | null;
  legalTargets?: ReadonlyArray<CellRef>;
  onCellClick?: (row: number, col: number) => void;
};

export default function Board({
  name,
  theme,
  markers = [],
  deployCells = [],
  activeDeployPlayer = null,
  onDeployCellClick,
  selectedCell = null,
  legalTargets = [],
  onCellClick,
}: BoardProps) {
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const isDark = (row + col) % 2 === 1;
      const clickable = onCellClick !== undefined;
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
          onClick={clickable ? () => onCellClick(row, col) : undefined}
          style={{ cursor: clickable ? 'pointer' : 'default' }}
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
        pointerEvents="none"
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
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {`r${row}`}
      </text>
    );
  }

  const selectionEl = selectedCell ? (
    <rect
      key="selection"
      x={ORIGIN_X + selectedCell.col * CELL + 2}
      y={ORIGIN_Y + selectedCell.row * CELL + 2}
      width={CELL - 4}
      height={CELL - 4}
      rx={4}
      fill="none"
      stroke="#f5c343"
      strokeWidth={3}
      pointerEvents="none"
    />
  ) : null;

  const targetEls = legalTargets.map((t) => {
    const cx = ORIGIN_X + t.col * CELL + CELL / 2;
    const cy = ORIGIN_Y + t.row * CELL + CELL / 2;
    return (
      <circle
        key={`tgt-${t.row}-${t.col}`}
        cx={cx}
        cy={cy}
        r={CELL * 0.18}
        fill="rgba(245, 195, 67, 0.85)"
        stroke="rgba(0, 0, 0, 0.45)"
        strokeWidth={0.8}
        pointerEvents="none"
      />
    );
  });

  const deployEls = deployCells.map((d) => {
    const style = DEPLOY_STYLE[d.player];
    const isActive = activeDeployPlayer === d.player;
    const inset = 4;
    return (
      <rect
        key={`d-${d.player}-${d.row}-${d.col}`}
        x={ORIGIN_X + d.col * CELL + inset}
        y={ORIGIN_Y + d.row * CELL + inset}
        width={CELL - inset * 2}
        height={CELL - inset * 2}
        rx={6}
        fill={isActive ? style.activeFill : style.fill}
        stroke={style.stroke}
        strokeWidth={isActive ? 2.5 : 1.5}
        strokeDasharray={isActive ? undefined : '4 3'}
        onClick={isActive && onDeployCellClick ? () => onDeployCellClick(d.player) : undefined}
        pointerEvents={isActive && onDeployCellClick ? 'auto' : 'none'}
        style={{ cursor: isActive && onDeployCellClick ? 'pointer' : 'default' }}
      >
        {isActive && (
          <animate
            attributeName="opacity"
            values="0.7;1;0.7"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}
      </rect>
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
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {m.symbol}
      </text>
    );
  });

  const badgeEls = markers
    .filter((m) => m.badge)
    .map((m) => (
      <text
        key={`bdg-${m.row}-${m.col}-${m.badge}`}
        x={ORIGIN_X + m.col * CELL + CELL - 4}
        y={ORIGIN_Y + m.row * CELL + 4}
        textAnchor="end"
        dominantBaseline="hanging"
        fontSize={CELL * 0.28}
        fontFamily="system-ui, sans-serif"
        fill="#f5c343"
        stroke="#1a1a1a"
        strokeWidth={0.4}
        paintOrder="stroke"
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {m.badge}
      </text>
    ));

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
        {selectionEl}
        {markerEls}
        {badgeEls}
        {targetEls}
      </svg>
    </div>
  );
}
