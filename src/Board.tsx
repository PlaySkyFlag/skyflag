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
  // Stable identity (piece id) used as the React key so the same DOM
  // element persists across moves and CSS can animate x/y transitions.
  id?: string;
};

export type DeployCell = {
  row: number;
  col: number;
  player: Player;
};

// Hex values mirror the player palette in App.css (:root section):
//   p1.fill      = --slate-fill      (#0f1830)
//   p2.fill      = --ivory-fill      (#fff4dc)
//   p1 deploy    = --slate-accent    (#a8b8d8 / rgba(168,184,216,…))
//   p2 deploy    = --ivory-fill      (#fff4dc / rgba(255,244,220,…))
// Keep the two sources in sync if either side changes.
const MARKER_STYLE: Record<MarkerKind, { fill: string; stroke: string; strokeWidth: number }> = {
  lift:  { fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 0.6 },
  nexus: { fill: '#f5c343', stroke: '#1a1a1a', strokeWidth: 0.8 },
  p1:    { fill: '#0f1830', stroke: '#e8e8e8', strokeWidth: 0.8 },
  p2:    { fill: '#fff4dc', stroke: '#1a1a1a', strokeWidth: 0.8 },
};

const DEPLOY_STYLE: Record<Player, { stroke: string; fill: string; activeFill: string }> = {
  p1: { stroke: '#a8b8d8', fill: 'rgba(168,184,216,0.30)', activeFill: 'rgba(168,184,216,0.55)' },
  p2: { stroke: '#fff4dc', fill: 'rgba(255,244,220,0.30)', activeFill: 'rgba(255,244,220,0.55)' },
};

type CellRef = {
  row: number;
  col: number;
  kind?: 'move' | 'lift-up' | 'lift-down';
};

type BoardProps = {
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
        fontSize={14}
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
        fontSize={14}
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
    if (t.kind === 'lift-up' || t.kind === 'lift-down') {
      const arrow = t.kind === 'lift-up' ? '↑' : '↓';
      return (
        <g key={`lt-${t.row}-${t.col}-${t.kind}`} pointerEvents="none">
          <circle
            cx={cx}
            cy={cy}
            r={CELL * 0.26}
            fill="rgba(95, 213, 199, 0.92)"
            stroke="rgba(0, 0, 0, 0.55)"
            strokeWidth={0.9}
          />
          <text
            x={cx}
            y={cy + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={CELL * 0.42}
            fontFamily="system-ui, sans-serif"
            fontWeight={700}
            fill="#0a1f1c"
            style={{ userSelect: 'none' }}
          >
            {arrow}
          </text>
        </g>
      );
    }
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

  const deployEls = deployCells.flatMap((d) => {
    const style = DEPLOY_STYLE[d.player];
    const isActive = activeDeployPlayer === d.player;
    const inset = 4;
    const cx = ORIGIN_X + d.col * CELL + CELL / 2;
    const cy = ORIGIN_Y + d.row * CELL + CELL / 2;
    return [
      <rect
        key={`d-${d.player}-${d.row}-${d.col}`}
        x={ORIGIN_X + d.col * CELL + inset}
        y={ORIGIN_Y + d.row * CELL + inset}
        width={CELL - inset * 2}
        height={CELL - inset * 2}
        rx={6}
        fill={isActive ? style.activeFill : style.fill}
        stroke={style.stroke}
        strokeWidth={isActive ? 3 : 2}
        strokeDasharray={isActive ? undefined : '5 3'}
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
      </rect>,
      <text
        key={`d-label-${d.player}-${d.row}-${d.col}`}
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={CELL * 0.18}
        fontWeight={700}
        fontFamily="system-ui, sans-serif"
        fill={style.stroke}
        stroke="rgba(0, 0, 0, 0.55)"
        strokeWidth={0.5}
        paintOrder="stroke"
        pointerEvents="none"
        style={{ userSelect: 'none', letterSpacing: '0.12em' }}
      >
        DEPLOY
      </text>,
    ];
  });

  // Lifts get a custom translucent raised-box treatment instead of plain
  // text glyphs — a clearer visual hint that the cell connects layers.
  const liftEls = markers
    .filter((m) => m.kind === 'lift')
    .map((m) => {
      const inset = 8;
      const x = ORIGIN_X + m.col * CELL + inset;
      const y = ORIGIN_Y + m.row * CELL + inset;
      const size = CELL - inset * 2;
      const cx = ORIGIN_X + m.col * CELL + CELL / 2;
      const cy = ORIGIN_Y + m.row * CELL + CELL / 2;
      return (
        <g key={`lift-${m.row}-${m.col}`} pointerEvents="none">
          <rect
            x={x}
            y={y}
            width={size}
            height={size}
            rx={4}
            fill="rgba(255, 255, 255, 0.10)"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth={1}
          />
          {/* Top edge highlight for a raised 3D feel */}
          <line
            x1={x + 2}
            y1={y + 1.5}
            x2={x + size - 2}
            y2={y + 1.5}
            stroke="rgba(255, 255, 255, 0.7)"
            strokeWidth={0.8}
          />
          {/* Bottom edge shadow to match */}
          <line
            x1={x + 2}
            y1={y + size - 1.5}
            x2={x + size - 2}
            y2={y + size - 1.5}
            stroke="rgba(0, 0, 0, 0.45)"
            strokeWidth={0.8}
          />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={CELL * 0.5}
            fontFamily="system-ui, sans-serif"
            fill="rgba(255, 255, 255, 0.9)"
            stroke="rgba(0, 0, 0, 0.55)"
            strokeWidth={0.4}
            paintOrder="stroke"
            style={{ userSelect: 'none' }}
          >
            ↕
          </text>
        </g>
      );
    });

  // Nexus (the final objective on Space, cell 3,3) gets a custom rendering
  // — pulsing gold halo, mid-ring, four compass spikes, and an inner disc
  // — to make it visually distinct from a regular flag.
  const nexusEls = markers
    .filter((m) => m.kind === 'nexus')
    .map((m) => {
      const cx = ORIGIN_X + m.col * CELL + CELL / 2;
      const cy = ORIGIN_Y + m.row * CELL + CELL / 2;
      const innerR = CELL * 0.16;
      const ringR = CELL * 0.28;
      const haloR = CELL * 0.42;
      const spikeAngles = [0, 90, 180, 270];
      return (
        <g key={`nexus-${m.row}-${m.col}`} pointerEvents="none">
          {/* Outer halo — slowly pulsing gold glow */}
          <circle cx={cx} cy={cy} r={haloR} fill="rgba(245, 195, 67, 0.20)">
            <animate
              attributeName="r"
              values={`${haloR};${haloR * 1.18};${haloR}`}
              dur="2.6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.22;0.06;0.22"
              dur="2.6s"
              repeatCount="indefinite"
            />
          </circle>
          {/* Compass spikes — four short rays at the cardinal directions */}
          {spikeAngles.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = cx + Math.cos(rad) * (ringR + 1.5);
            const y1 = cy + Math.sin(rad) * (ringR + 1.5);
            const x2 = cx + Math.cos(rad) * (ringR + 6);
            const y2 = cy + Math.sin(rad) * (ringR + 6);
            return (
              <line
                key={`spike-${deg}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(245, 195, 67, 0.9)"
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            );
          })}
          {/* Mid-ring */}
          <circle
            cx={cx}
            cy={cy}
            r={ringR}
            fill="none"
            stroke="rgba(245, 195, 67, 0.9)"
            strokeWidth={1.5}
          />
          {/* Inner gold disc */}
          <circle
            cx={cx}
            cy={cy}
            r={innerR}
            fill="#f5c343"
            stroke="#1a1a1a"
            strokeWidth={0.6}
          />
        </g>
      );
    });

  const markerEls = markers
    .filter((m) => m.kind !== 'lift' && m.kind !== 'nexus')
    .map((m) => {
      const style = MARKER_STYLE[m.kind];
      return (
        <text
          key={m.id ?? `m-${m.row}-${m.col}-${m.symbol}`}
          className={m.id ? 'piece-marker' : undefined}
          x={ORIGIN_X + m.col * CELL + CELL / 2}
          y={ORIGIN_Y + m.row * CELL + CELL / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={CELL * 0.75}
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: SVG_WIDTH,
      }}
    >
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          background: theme.background,
          borderRadius: 8,
          height: 'auto',
          display: 'block',
        }}
      >
        {cells}
        {colLabels}
        {rowLabels}
        {deployEls}
        {selectionEl}
        {liftEls}
        {nexusEls}
        {markerEls}
        {badgeEls}
        {targetEls}
      </svg>
    </div>
  );
}
