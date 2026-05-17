// Eval graph — inline SVG line chart of position evaluation over
// the course of a reviewed game. Always renders from p1's
// perspective so the line is consistent regardless of whose turn
// it is at a given ply: positive = good for p1 (White Stags),
// negative = good for p2 (Grey Ravens).
//
// Click anywhere on the chart to jump the review scrubber to the
// nearest analyzed move. A vertical guide line shows the current
// scrubber position.
//
// Pure SVG — no charting library — both because the data series is
// trivially small (one game = tens of points) and because we already
// pay for SVG in the bundle for boards / icons; no extra weight.

import { useMemo } from 'react';
import type { MoveAnalysis } from './game/review';

type Props = {
  analyses: MoveAnalysis[];
  // The Review's current ply (1-indexed: ply 1 = after first move).
  currentPly: number;
  onPlyClick: (ply: number) => void;
};

// Logical viewBox dimensions — CSS scales the rendered size, so
// these are arbitrary "design units" not pixels.
const W = 700;
const H = 100;
const PAD_X = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 10;

export default function EvalGraph({ analyses, currentPly, onPlyClick }: Props) {
  // Build the p1-perspective eval series. The analysis stores
  // playedEval from the mover's perspective; flip sign when mover
  // is p2 so the line plots consistently as p1-favorability.
  const series = useMemo(
    () =>
      analyses.map((a) => ({
        ply: a.ply,
        eval: a.mover === 'p1' ? a.playedEval : -a.playedEval,
      })),
    [analyses],
  );

  // Y-axis range — auto-fit to the data with a floor (800) so quiet
  // games don't show every 30-point wobble as a mountain, and a
  // ceiling (3000) so a blunder-out-of-the-flag-corner doesn't
  // compress the rest of the game into a flat line at the center.
  const axisRange = useMemo(() => {
    if (series.length === 0) return 800;
    let m = 800;
    for (const p of series) {
      const v = Math.abs(p.eval);
      if (v > m) m = v;
    }
    return Math.min(m, 3000);
  }, [series]);

  // Which series index is closest to the scrubber's current ply.
  // currentPly is 1-indexed (ply 1 = state after first action),
  // so the analysis at series[i].ply produced position currentPly
  // when currentPly === series[i].ply + 1.
  const currentSeriesIdx = useMemo(() => {
    if (series.length === 0) return -1;
    const targetAnalysisPly = currentPly - 1;
    let bestIdx = 0;
    let bestDist = Math.abs(series[0].ply - targetAnalysisPly);
    for (let i = 1; i < series.length; i++) {
      const d = Math.abs(series[i].ply - targetAnalysisPly);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [series, currentPly]);

  if (series.length === 0) {
    return (
      <div className="eval-graph eval-graph-empty">
        Eval graph will appear here once analysis completes.
      </div>
    );
  }

  const usableWidth = W - 2 * PAD_X;
  const usableHeight = H - PAD_TOP - PAD_BOTTOM;
  const centerY = PAD_TOP + usableHeight / 2;
  const stepX =
    series.length > 1 ? usableWidth / (series.length - 1) : 0;

  const xForIdx = (i: number) => PAD_X + stepX * i;
  const yForEval = (e: number) => {
    const clamped = Math.max(-axisRange, Math.min(axisRange, e));
    return centerY - (clamped / axisRange) * (usableHeight / 2);
  };

  const pathPoints = series
    .map((p, i) => `${xForIdx(i).toFixed(1)},${yForEval(p.eval).toFixed(1)}`)
    .join(' ');

  // Filled area below/above the line — coloured per side. Two
  // separate fills clipped to top half vs bottom half so each
  // half visually attributes the advantage to the right side.
  const areaPath = (() => {
    const pts: string[] = [];
    pts.push(`${xForIdx(0).toFixed(1)},${centerY.toFixed(1)}`);
    for (let i = 0; i < series.length; i++) {
      pts.push(`${xForIdx(i).toFixed(1)},${yForEval(series[i].eval).toFixed(1)}`);
    }
    pts.push(`${xForIdx(series.length - 1).toFixed(1)},${centerY.toFixed(1)}`);
    pts.push('Z');
    return 'M' + pts.join(' L').replace(' LZ', ' Z');
  })();

  const guideX = currentSeriesIdx >= 0 ? xForIdx(currentSeriesIdx) : null;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // SVG uses preserveAspectRatio="none" so the click coordinate
    // needs to be scaled from CSS pixels back into the logical
    // viewBox width.
    const cssX = e.clientX - rect.left;
    const logicalX = (cssX / rect.width) * W;
    if (stepX === 0) {
      onPlyClick(series[0].ply + 1);
      return;
    }
    const idx = Math.round((logicalX - PAD_X) / stepX);
    const clampedIdx = Math.max(0, Math.min(series.length - 1, idx));
    // Scrubber convention: jump to the state AFTER this analysis's
    // ply, so add 1.
    onPlyClick(series[clampedIdx].ply + 1);
  };

  return (
    <div className="eval-graph">
      <div className="eval-graph-axis-labels">
        <span className="eval-graph-axis-top">↑ White Stags</span>
        <span className="eval-graph-axis-bot">↓ Grey Ravens</span>
      </div>
      <svg
        className="eval-graph-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Position evaluation over ${series.length} analyzed moves. Click to jump to that move.`}
        onClick={handleClick}
      >
        {/* Background bands: top half = p1 advantage tint, bottom
            half = p2 advantage tint. Faint so the line stays the
            primary signal. */}
        <rect
          x={0}
          y={PAD_TOP}
          width={W}
          height={usableHeight / 2}
          fill="rgba(168, 184, 216, 0.05)"
        />
        <rect
          x={0}
          y={centerY}
          width={W}
          height={usableHeight / 2}
          fill="rgba(245, 195, 67, 0.05)"
        />
        {/* Filled area under/over the curve, clipped to the
            relevant half so positive areas tint gold and negative
            areas tint slate. Using clipPath would be ideal but a
            single filled path with low opacity reads fine for the
            scale of this chart. */}
        <path d={areaPath} fill="rgba(194, 164, 107, 0.16)" />
        {/* Center line (eval = 0) */}
        <line
          x1={0}
          y1={centerY}
          x2={W}
          y2={centerY}
          stroke="rgba(255, 255, 255, 0.20)"
          strokeDasharray="4 4"
        />
        {/* The actual eval line */}
        <polyline
          points={pathPoints}
          fill="none"
          stroke="#C2A46B"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Current-scrubber-position guide */}
        {guideX !== null && (
          <line
            x1={guideX}
            y1={PAD_TOP - 4}
            x2={guideX}
            y2={H - PAD_BOTTOM + 4}
            stroke="#7be0a3"
            strokeWidth={2}
            opacity={0.7}
          />
        )}
      </svg>
    </div>
  );
}
