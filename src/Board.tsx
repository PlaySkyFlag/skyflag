const BOARD_SIZE = 6;
const CELL = 56;
const PADDING = 14;
const SVG_SIZE = BOARD_SIZE * CELL + PADDING * 2;

export type BoardTheme = {
  lightFill: string;
  darkFill: string;
  background: string;
  stroke: string;
};

export type MarkerKind = 'lift' | 'nexus' | 'p1' | 'p2';

export type Marker = {
  row: number;
  col: number;
  symbol: string;
  kind: MarkerKind;
};

const MARKER_STYLE: Record<MarkerKind, { fill: string; stroke: string; strokeWidth: number }> = {
  lift:  { fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 0.6 },
  nexus: { fill: '#f5c343', stroke: '#1a1a1a', strokeWidth: 0.8 },
  p1:    { fill: '#1a2540', stroke: '#e8e8e8', strokeWidth: 0.8 },
  p2:    { fill: '#f5e8d0', stroke: '#1a1a1a', strokeWidth: 0.8 },
};

type BoardProps = {
  name: string;
  theme: BoardTheme;
  markers?: Marker[];
};

export default function Board({ name, theme, markers = [] }: BoardProps) {
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const isDark = (row + col) % 2 === 1;
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={PADDING + col * CELL}
          y={PADDING + row * CELL}
          width={CELL}
          height={CELL}
          fill={isDark ? theme.darkFill : theme.lightFill}
          stroke={theme.stroke}
          strokeWidth={1}
        />
      );
    }
  }

  const markerEls = markers.map((m) => {
    const style = MARKER_STYLE[m.kind];
    return (
      <text
        key={`m-${m.row}-${m.col}-${m.symbol}`}
        x={PADDING + m.col * CELL + CELL / 2}
        y={PADDING + m.row * CELL + CELL / 2}
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
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        style={{ background: theme.background, borderRadius: 8 }}
      >
        {cells}
        {markerEls}
      </svg>
    </div>
  );
}
