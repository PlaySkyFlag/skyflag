import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { sendRequest } from './game/friends';
import { supabase } from './game/supabase';
import type { GameState, GameStatus, Player, RoomState } from './game/types';
import { stashReviewSession } from './game/reviewSession';

const PLAYER_NAME: Record<Player, string> = { p1: 'Grey Ravens', p2: 'White Stags' };

// See StatusBar.tsx for why we derive these from GameStatus rather
// than spelling the union out by hand.
type WonReason = Extract<GameStatus, { kind: 'won' }>['reason'];
type DrawReason = Extract<GameStatus, { kind: 'draw' }>['reason'];

const REASON_LABEL: Record<WonReason | DrawReason, string> = {
  nexus: 'Nexus capture',
  elimination: 'elimination',
  resignation: 'resignation',
  'time-out': 'time-out — opponent ran out of time',
  'turn-limit': 'turn limit reached',
  stalemate: 'stalemate — no legal moves left',
  agreement: 'mutual agreement',
};

type Props = {
  state: GameState;
  user: User | null;
  room: RoomState | null;
  onPlayAgain: () => void;
};

// End-game celebration overlay. Renders when the game has finished (won or
// draw) and hasn't been dismissed via "View board". Auto-resets on the
// next game so it shows again when the next game ends.
export default function EndGameOverlay({ state, user, room, onPlayAgain }: Props) {
  const [dismissed, setDismissed] = useState(false);
  // Opponent's user_id, fetched lazily from the games row when this is an
  // MP game. Null for solo / 2P hot-seat or while the lookup is pending.
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendNote, setFriendNote] = useState<string | null>(null);

  useEffect(() => {
    if (state.status.kind === 'in-progress') {
      setDismissed(false);
      setFriendNote(null);
    }
  }, [state.status.kind]);

  // Look up the opponent's user_id once the game has ended in an MP room.
  // We read p1_id / p2_id from the games row and pick whichever isn't us.
  useEffect(() => {
    if (state.status.kind === 'in-progress') return;
    if (!supabase || !user || !room) {
      setOpponentId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('games')
        .select('p1_id, p2_id')
        .eq('room_code', room.code)
        .maybeSingle();
      if (cancelled || !data) return;
      const { p1_id, p2_id } = data as { p1_id: string; p2_id: string | null };
      const other = p1_id === user.id ? p2_id : p1_id;
      setOpponentId(other ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status.kind, user, room]);

  if (state.status.kind === 'in-progress') return null;
  if (dismissed) return null;

  const status = state.status;

  const onAddFriend = async () => {
    if (!user || !opponentId) return;
    setFriendBusy(true);
    const r = await sendRequest(user.id, opponentId);
    setFriendBusy(false);
    if (r.ok) {
      setFriendNote('Friend request sent.');
    } else {
      setFriendNote(r.message);
    }
  };

  return (
    <div className="end-game-overlay" role="dialog" aria-modal="true">
      <div className="end-game-card">
        <h2 className="end-game-title">
          {status.kind === 'won' ? `${PLAYER_NAME[status.winner]} wins!` : 'Draw'}
        </h2>
        <p className="end-game-reason">
          {status.kind === 'won'
            ? `by ${REASON_LABEL[status.reason]}`
            : REASON_LABEL[status.reason]}
        </p>
        {/* Handwritten celebratory rally — Caveat font + slight tilt
            gives the end-game moment a personal, signed-by-the-house
            feel. Only shown on a finished game so it doesn't appear
            during a draw-offer modal or similar mid-game state. */}
        <p className="end-game-rally tagline-script">Three worlds. One proof.</p>
        <div className="end-game-actions">
          <button type="button" className="end-game-btn" onClick={onPlayAgain}>
            Play again
          </button>
          {/* Review opens a dedicated /review/<slug> route that
              walks through every move with engine analysis. The
              session handoff is via sessionStorage so 1P / 2P
              local games (no DB record) can also be reviewed. */}
          <button
            type="button"
            className="end-game-btn end-game-btn--subtle"
            onClick={() => {
              stashReviewSession({
                history: state.history,
                finalState: state,
                roomCode: room?.code,
              });
              // Hard navigation — the /review route is its own lazy
              // chunk and main.tsx dispatches off window.location.
              window.location.assign(
                room ? `/review/${room.code}` : '/review/current',
              );
            }}
          >
            📊 Review this game
          </button>
          {user && opponentId && (
            <button
              type="button"
              className="end-game-btn end-game-btn--subtle"
              disabled={friendBusy || friendNote !== null}
              onClick={onAddFriend}
            >
              {friendNote ? 'Sent ✓' : friendBusy ? 'Sending…' : 'Add as friend'}
            </button>
          )}
          <button
            type="button"
            className="end-game-btn end-game-btn--subtle"
            onClick={() => setDismissed(true)}
          >
            View board
          </button>
        </div>
        {friendNote && <p className="end-game-friend-note">{friendNote}</p>}
      </div>
    </div>
  );
}
