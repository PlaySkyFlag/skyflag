// sessionStorage handoff for /review/current. Kept in its own leaf
// module (no JSX, no theme/Board imports) so it can be imported
// statically by EndGameOverlay without dragging Review.tsx — and
// therefore the entire Board + themes graph — into the App chunk.
// That static link was causing a circular chunk dependency that
// crashed the themes chunk at top-level ("e is not a function").

import type { GameState, HistoryEntry } from './types';

const REVIEW_SESSION_KEY = '3phor.review-session.v1';

export type ReviewSession = {
  history: HistoryEntry[];
  finalState: GameState;
  p1Nickname?: string;
  p2Nickname?: string;
  roomCode?: string;
};

export function stashReviewSession(session: ReviewSession): void {
  try {
    sessionStorage.setItem(REVIEW_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* private mode / quota — review just won't be available */
  }
}

export function loadReviewSession(): ReviewSession | null {
  try {
    const raw = sessionStorage.getItem(REVIEW_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReviewSession;
  } catch {
    return null;
  }
}
