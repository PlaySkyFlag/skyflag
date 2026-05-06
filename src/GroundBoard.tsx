const BOARD_SIZE = 6;
const CELL = 64;
const PADDING = 16;
const SVG_SIZE = BOARD_SIZE * CELL + PADDING * 2;

export default function GroundBoard() {
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
          fill={isDark ? '#6b8e5a' : '#a8c48f'}
          stroke="#2d3b25"
          strokeWidth={1}
        />
      );
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <h2 style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>Ground / Terran</h2>
      <svg
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        style={{ background: '#1f2a17', borderRadius: 8 }}
      >
        {cells}
      </svg>
    </div>
  );
}
