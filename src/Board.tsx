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

type BoardProps = {
  name: string;
  theme: BoardTheme;
};

export default function Board({ name, theme }: BoardProps) {
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
      </svg>
    </div>
  );
}
