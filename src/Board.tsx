const BOARD_SIZE = 6;
const CELL = 56;
const PADDING = 14;
const LABEL_GUTTER = 20;
const ORIGIN_X = PADDING + LABEL_GUTTER;
const ORIGIN_Y = PADDING + LABEL_GUTTER;
const SVG_WIDTH = ORIGIN_X + BOARD_SIZE * CELL + PADDING;
const SVG_HEIGHT = ORIGIN_Y + BOARD_SIZE * CELL + PADDING;


import type { Layer, Player } from './game/types';

export type BoardTheme = {
  lightFill: string;
  darkFill: string;
  background: string;
  stroke: string;
  label: string;
  // Optional layer identity — drives subtle atmospheric decoration
  // (starfield on space, cloud wisps on sky, warm gradient on ground).
  kind?: Layer;
};

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

// Fixed-position starfield for the Space board. Hand-placed so stars sit
// in a pleasant scatter rather than landing on cell centers where pieces
// stand. Coordinates are in SVG units relative to the board viewBox.
const SPACE_STARS: Array<{ x: number; y: number; r: number; o: number }> = [
  { x: 22,  y: 32,  r: 1.1, o: 0.85 },
  { x: 70,  y: 14,  r: 0.7, o: 0.55 },
  { x: 168, y: 22,  r: 1.4, o: 0.90 },
  { x: 248, y: 10,  r: 0.8, o: 0.60 },
  { x: 320, y: 28,  r: 1.0, o: 0.75 },
  { x: 360, y: 88,  r: 0.6, o: 0.50 },
  { x: 18,  y: 140, r: 0.9, o: 0.70 },
  { x: 16,  y: 230, r: 1.2, o: 0.80 },
  { x: 372, y: 200, r: 1.3, o: 0.85 },
  { x: 358, y: 312, r: 0.7, o: 0.55 },
  { x: 86,  y: 364, r: 1.0, o: 0.75 },
  { x: 196, y: 372, r: 0.6, o: 0.50 },
  { x: 296, y: 358, r: 1.1, o: 0.80 },
  { x: 110, y: 18,  r: 0.5, o: 0.45 },
  { x: 50,  y: 320, r: 0.6, o: 0.50 },
  { x: 220, y: 8,   r: 0.5, o: 0.40 },
  // Second wave — denser starfield for a cosmic feel
  { x: 44,  y: 92,  r: 0.5, o: 0.55 },
  { x: 130, y: 46,  r: 0.6, o: 0.60 },
  { x: 210, y: 56,  r: 0.4, o: 0.45 },
  { x: 280, y: 60,  r: 0.7, o: 0.65 },
  { x: 348, y: 152, r: 0.5, o: 0.55 },
  { x: 374, y: 268, r: 0.6, o: 0.60 },
  { x: 250, y: 326, r: 0.5, o: 0.50 },
  { x: 154, y: 348, r: 0.7, o: 0.65 },
  { x: 36,  y: 280, r: 0.4, o: 0.45 },
  { x: 78,  y: 198, r: 0.6, o: 0.60 },
  { x: 268, y: 168, r: 0.5, o: 0.50 },
  { x: 120, y: 256, r: 0.4, o: 0.45 },
  { x: 308, y: 240, r: 0.6, o: 0.60 },
  { x: 192, y: 116, r: 0.5, o: 0.55 },
];

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
  // Layer-specific atmosphere: gradient/nebula painted before the cells,
  // and a starfield overlay for Space that floats above the cells at low
  // opacity (so empty cells feel like a window onto the cosmos without
  // muddying piece visibility).
  const atmosphereBack = (() => {
    if (theme.kind === 'ground') {
      // Distant mountain range silhouette along the top, plus a few
      // foreground rocks scattered in the margins. Painted before the
      // cells so the play surface stays uncluttered.
      return (
        <>
          <defs>
            <linearGradient id="atmo-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="rgba(255, 215, 150, 0.32)" />
              <stop offset="55%" stopColor="rgba(140, 170, 100, 0.10)" />
              <stop offset="100%" stopColor="rgba(30, 50, 20, 0.45)" />
            </linearGradient>
            <linearGradient id="atmo-mountain-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(120, 130, 150, 0.55)" />
              <stop offset="100%" stopColor="rgba(60, 70, 90, 0.30)" />
            </linearGradient>
            <linearGradient id="atmo-mountain-near" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(80, 95, 65, 0.70)" />
              <stop offset="100%" stopColor="rgba(40, 55, 30, 0.45)" />
            </linearGradient>
          </defs>
          <rect
            x={0}
            y={0}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            fill="url(#atmo-ground)"
            pointerEvents="none"
          />
          {/* Distant mountain range — far peaks (cooler/bluer) */}
          <path
            d={`M 0 22 L 38 6 L 70 18 L 102 4 L 138 16 L 168 8 L 200 22 L 232 10 L 268 18 L 298 6 L 332 20 L 360 12 L ${SVG_WIDTH} 22 L ${SVG_WIDTH} 34 L 0 34 Z`}
            fill="url(#atmo-mountain-far)"
            pointerEvents="none"
          />
          {/* Nearer mountain range — taller silhouettes overlapping the far range */}
          <path
            d={`M 0 30 L 22 14 L 52 26 L 88 12 L 120 28 L 156 18 L 188 30 L 222 14 L 256 26 L 292 16 L 322 28 L 356 18 L ${SVG_WIDTH} 30 L ${SVG_WIDTH} 36 L 0 36 Z`}
            fill="url(#atmo-mountain-near)"
            pointerEvents="none"
          />
          {/* Foreground rocks — small bumpy shapes in the margins */}
          <g fill="rgba(70, 60, 45, 0.55)" pointerEvents="none">
            {/* Left margin rock cluster */}
            <ellipse cx={14} cy={SVG_HEIGHT - 18} rx={11} ry={6} />
            <ellipse cx={22} cy={SVG_HEIGHT - 22} rx={7}  ry={5} />
            {/* Right margin rock cluster */}
            <ellipse cx={SVG_WIDTH - 16} cy={SVG_HEIGHT - 14} rx={13} ry={6} />
            <ellipse cx={SVG_WIDTH - 26} cy={SVG_HEIGHT - 18} rx={6}  ry={4} />
            {/* A few scattered pebbles along the bottom edge */}
            <ellipse cx={120} cy={SVG_HEIGHT - 10} rx={5} ry={2.5} />
            <ellipse cx={200} cy={SVG_HEIGHT - 8}  rx={4} ry={2} />
            <ellipse cx={270} cy={SVG_HEIGHT - 11} rx={6} ry={3} />
          </g>
        </>
      );
    }
    if (theme.kind === 'sky') {
      return (
        <>
          <defs>
            <linearGradient id="atmo-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(240, 250, 255, 0.45)" />
              <stop offset="100%" stopColor="rgba(80, 140, 200, 0.18)" />
            </linearGradient>
          </defs>
          <rect
            x={0}
            y={0}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            fill="url(#atmo-sky)"
            pointerEvents="none"
          />
        </>
      );
    }
    if (theme.kind === 'space') {
      // Saturn-like ringed planet anchored to the upper-left margin.
      // Sized to peek out without crowding the play area.
      const planetCx = 24;
      const planetCy = 24;
      const planetR = 28;
      return (
        <>
          <defs>
            <radialGradient id="atmo-nebula" cx="0.7" cy="0.3" r="0.7">
              <stop offset="0%"   stopColor="rgba(170, 100, 240, 0.55)" />
              <stop offset="55%"  stopColor="rgba(70, 40, 140, 0.25)" />
              <stop offset="100%" stopColor="rgba(20, 10, 50, 0)" />
            </radialGradient>
            <radialGradient id="atmo-nebula-2" cx="0.2" cy="0.85" r="0.55">
              <stop offset="0%"   stopColor="rgba(70, 130, 230, 0.45)" />
              <stop offset="100%" stopColor="rgba(20, 10, 50, 0)" />
            </radialGradient>
            <radialGradient id="atmo-nebula-3" cx="0.85" cy="0.78" r="0.4">
              <stop offset="0%"   stopColor="rgba(220, 80, 150, 0.35)" />
              <stop offset="100%" stopColor="rgba(20, 10, 50, 0)" />
            </radialGradient>
            <radialGradient id="atmo-planet" cx="0.35" cy="0.35" r="0.7">
              <stop offset="0%"   stopColor="rgba(255, 210, 150, 1)" />
              <stop offset="55%"  stopColor="rgba(220, 150, 90, 1)" />
              <stop offset="100%" stopColor="rgba(80, 40, 20, 1)" />
            </radialGradient>
          </defs>
          <rect
            x={0}
            y={0}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            fill="url(#atmo-nebula)"
            pointerEvents="none"
          />
          <rect
            x={0}
            y={0}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            fill="url(#atmo-nebula-2)"
            pointerEvents="none"
          />
          <rect
            x={0}
            y={0}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            fill="url(#atmo-nebula-3)"
            pointerEvents="none"
          />
          {/* Saturn-like planet — body, then rings drawn as two concentric
              ellipses rotated to a tilt. Outer ring back half is hidden by
              the planet body since planet is rendered between them. */}
          <g pointerEvents="none" opacity={0.85}>
            {/* Ring back half (drawn behind the planet) */}
            <ellipse
              cx={planetCx}
              cy={planetCy}
              rx={planetR * 1.95}
              ry={planetR * 0.45}
              fill="none"
              stroke="rgba(240, 200, 140, 0.55)"
              strokeWidth={2.2}
              transform={`rotate(-22 ${planetCx} ${planetCy})`}
            />
            <ellipse
              cx={planetCx}
              cy={planetCy}
              rx={planetR * 1.55}
              ry={planetR * 0.36}
              fill="none"
              stroke="rgba(240, 200, 140, 0.30)"
              strokeWidth={1.2}
              transform={`rotate(-22 ${planetCx} ${planetCy})`}
            />
            {/* Soft glow halo */}
            <circle
              cx={planetCx}
              cy={planetCy}
              r={planetR * 1.35}
              fill="rgba(255, 200, 140, 0.10)"
            />
            {/* Planet body */}
            <circle
              cx={planetCx}
              cy={planetCy}
              r={planetR}
              fill="url(#atmo-planet)"
            />
            {/* Banded atmosphere — two faint horizontal bands */}
            <ellipse
              cx={planetCx}
              cy={planetCy - planetR * 0.18}
              rx={planetR * 0.92}
              ry={planetR * 0.10}
              fill="rgba(180, 120, 70, 0.35)"
            />
            <ellipse
              cx={planetCx}
              cy={planetCy + planetR * 0.22}
              rx={planetR * 0.90}
              ry={planetR * 0.09}
              fill="rgba(120, 70, 40, 0.40)"
            />
            {/* Ring front half (drawn after the planet, so it covers it) */}
            <path
              d={`M ${planetCx - planetR * 1.95} ${planetCy} A ${planetR * 1.95} ${planetR * 0.45} 0 0 0 ${planetCx + planetR * 1.95} ${planetCy}`}
              fill="none"
              stroke="rgba(240, 200, 140, 0.85)"
              strokeWidth={2.4}
              transform={`rotate(-22 ${planetCx} ${planetCy})`}
            />
            <path
              d={`M ${planetCx - planetR * 1.55} ${planetCy} A ${planetR * 1.55} ${planetR * 0.36} 0 0 0 ${planetCx + planetR * 1.55} ${planetCy}`}
              fill="none"
              stroke="rgba(240, 200, 140, 0.55)"
              strokeWidth={1.4}
              transform={`rotate(-22 ${planetCx} ${planetCy})`}
            />
          </g>
          {/* Distant small planet — bottom-right margin, just a hint */}
          <circle
            cx={SVG_WIDTH - 22}
            cy={SVG_HEIGHT - 22}
            r={6}
            fill="rgba(180, 120, 220, 0.7)"
            pointerEvents="none"
          />
          <circle
            cx={SVG_WIDTH - 22}
            cy={SVG_HEIGHT - 22}
            r={11}
            fill="rgba(180, 120, 220, 0.18)"
            pointerEvents="none"
          />
        </>
      );
    }
    return null;
  })();

  // Atmosphere painted *after* the cells. Sky gets cloud wisps, Space
  // gets the starfield. Ground has none — its gradient is enough.
  const atmosphereFront = (() => {
    if (theme.kind === 'sky') {
      // Fluffy cumulus cloud — built from a flat-bottom ellipse plus a
      // cluster of overlapping circles on top to form bumpy lobes. Same
      // fill across all parts so they merge into a single silhouette.
      // s = scale (cloud spans roughly 5*s wide, 2.4*s tall).
      const cloud = (cx: number, cy: number, s: number, opacity: number, key: string) => (
        <g key={key} fill={`rgba(255, 255, 255, ${opacity})`} pointerEvents="none">
          <ellipse cx={cx}            cy={cy}            rx={s * 2.6} ry={s * 0.75} />
          <circle  cx={cx - s * 1.7}  cy={cy - s * 0.30} r={s * 0.85} />
          <circle  cx={cx - s * 0.7}  cy={cy - s * 0.85} r={s * 1.05} />
          <circle  cx={cx + s * 0.4}  cy={cy - s * 1.00} r={s * 1.10} />
          <circle  cx={cx + s * 1.4}  cy={cy - s * 0.55} r={s * 0.90} />
          <circle  cx={cx + s * 2.1}  cy={cy - s * 0.20} r={s * 0.65} />
          <circle  cx={cx - s * 0.1}  cy={cy - s * 0.20} r={s * 0.95} />
        </g>
      );
      return (
        <g pointerEvents="none">
          {cloud(75,  60,  16, 0.55, 'cl-1')}
          {cloud(305, 110, 19, 0.45, 'cl-2')}
          {cloud(145, 295, 17, 0.40, 'cl-3')}
          {cloud(330, 350, 14, 0.42, 'cl-4')}
          {cloud(215, 188, 13, 0.32, 'cl-5')}
        </g>
      );
    }
    if (theme.kind === 'space') {
      return (
        <g pointerEvents="none">
          {SPACE_STARS.map((s, i) => (
            <circle
              key={`star-${i}`}
              cx={s.x}
              cy={s.y}
              r={s.r * 1.35}
              fill="rgba(255, 250, 230, 1)"
              opacity={Math.min(1, s.o * 1.15)}
            />
          ))}
          {/* A few brighter stars with a faint glow */}
          {[SPACE_STARS[2], SPACE_STARS[7], SPACE_STARS[8], SPACE_STARS[12]].map((s, i) => (
            <circle
              key={`glow-${i}`}
              cx={s.x}
              cy={s.y}
              r={s.r * 3.2}
              fill="rgba(255, 245, 220, 0.18)"
            />
          ))}
        </g>
      );
    }
    return null;
  })();

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
      // Per-piece sizing — Captain largest, then Pilot, Rover, Soldier
      // (mirrors the chess hierarchy and gives the board a clearer
      // visual rank). Flag (⚑) keeps a moderate size.
      const sizeBySymbol: Record<string, number> = {
        '♚': 0.98, // captain (king)
        '♝': 0.88, // pilot (bishop)
        '♜': 0.82, // rover (rook)
        '♟': 0.72, // soldier (pawn)
        '⚑': 0.78, // flag
      };
      const size = sizeBySymbol[m.symbol] ?? 0.78;
      return (
        <text
          key={m.id ?? `m-${m.row}-${m.col}-${m.symbol}`}
          className={m.id ? 'piece-marker' : undefined}
          x={ORIGIN_X + m.col * CELL + CELL / 2}
          y={ORIGIN_Y + m.row * CELL + CELL / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={CELL * size}
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
        {atmosphereBack}
        {cells}
        {colLabels}
        {rowLabels}
        {atmosphereFront}
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
