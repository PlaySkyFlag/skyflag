// Rating-history sparkline. Plus-only feature that draws the user's
// online ELO rating over time, using rows from game_results that
// reference them as winner or loser.
//
// Inline SVG — no charting library needed for a 200x60-ish sparkline.
// Min/max axes pad slightly so the line never touches the edge.

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './game/supabase';

type Point = { when: number; rating: number };

type Props = {
  user: User;
  // True if the user is entitled to see the graph. When false, we
  // render a teaser placeholder + Plus CTA instead of the actual data.
  hasPlus: boolean;
};

const WIDTH = 320;
const HEIGHT = 80;
const PAD_X = 4;
const PAD_Y = 8;

export default function RatingHistory({ user, hasPlus }: Props) {
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    if (!hasPlus || !supabase) return;
    const sb = supabase;
    const isMe = (id: string) => id === user.id;
    sb.from('game_results')
      .select('winner_user_id, loser_user_id, winner_rating_after, loser_rating_after, created_at')
      .or(`winner_user_id.eq.${user.id},loser_user_id.eq.${user.id}`)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const pts: Point[] = [];
        for (const row of data as Array<{
          winner_user_id: string | null;
          loser_user_id: string | null;
          winner_rating_after: number | null;
          loser_rating_after: number | null;
          created_at: string | null;
        }>) {
          const when = row.created_at ? new Date(row.created_at).getTime() : 0;
          const rating =
            row.winner_user_id && isMe(row.winner_user_id)
              ? row.winner_rating_after
              : row.loser_user_id && isMe(row.loser_user_id)
                ? row.loser_rating_after
                : null;
          if (when > 0 && rating !== null) pts.push({ when, rating });
        }
        setPoints(pts);
      });
  }, [user.id, hasPlus]);

  // Plus-locked teaser. We could hide the section entirely for non-
  // subscribers, but surfacing it as a teaser with a CTA is a known
  // conversion pattern — users see what they're missing.
  if (!hasPlus) {
    return (
      <div className="rating-history rating-history-locked">
        <div className="rating-history-header">
          <strong>Rating history</strong>
          <span className="rating-history-plus">Plus</span>
        </div>
        <p className="rating-history-body">
          See your ELO trajectory over every rated game. Subscribe to
          Plus to unlock.
        </p>
      </div>
    );
  }

  if (points === null) {
    return (
      <div className="rating-history">
        <div className="rating-history-header"><strong>Rating history</strong></div>
        <p className="rating-history-body">Loading…</p>
      </div>
    );
  }

  if (points.length < 2) {
    return (
      <div className="rating-history">
        <div className="rating-history-header"><strong>Rating history</strong></div>
        <p className="rating-history-body">
          Play a few rated games and your rating curve will start
          appearing here.
        </p>
      </div>
    );
  }

  // Compute the SVG path. Scale time to x, rating to y (inverted so
  // higher rating = higher on screen).
  const firstT = points[0].when;
  const lastT = points[points.length - 1].when;
  const tSpan = Math.max(1, lastT - firstT);
  const minR = Math.min(...points.map((p) => p.rating));
  const maxR = Math.max(...points.map((p) => p.rating));
  const rSpan = Math.max(20, maxR - minR); // floor span at 20 so a flat line still looks like a chart

  const xOf = (t: number) => PAD_X + ((t - firstT) / tSpan) * (WIDTH - 2 * PAD_X);
  const yOf = (r: number) => HEIGHT - PAD_Y - ((r - minR) / rSpan) * (HEIGHT - 2 * PAD_Y);

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.when).toFixed(1)} ${yOf(p.rating).toFixed(1)}`)
    .join(' ');

  const current = points[points.length - 1].rating;
  const start = points[0].rating;
  const delta = current - start;
  const deltaSign = delta > 0 ? '+' : '';
  const deltaClass = delta > 0 ? 'rating-history-up' : delta < 0 ? 'rating-history-down' : '';

  return (
    <div className="rating-history">
      <div className="rating-history-header">
        <strong>Rating history</strong>
        <span className={`rating-history-delta ${deltaClass}`}>
          {deltaSign}{delta} over {points.length} games
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="rating-history-svg"
        preserveAspectRatio="none"
      >
        {/* Faint baseline at the user's starting rating */}
        <line
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={yOf(start)}
          y2={yOf(start)}
          stroke="rgba(194, 164, 107, 0.15)"
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#C2A46B"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Highlight the latest point */}
        <circle
          cx={xOf(points[points.length - 1].when)}
          cy={yOf(current)}
          r={3}
          fill="#C2A46B"
        />
      </svg>
      <div className="rating-history-footer">
        <span>{start}</span>
        <span>→</span>
        <span><strong>{current}</strong></span>
      </div>
    </div>
  );
}
