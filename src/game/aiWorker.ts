// Web Worker entry — runs the minimax search on a background thread so the
// UI stays responsive while the AI thinks. The main thread posts a state,
// the worker computes the best action, and posts it back. Bundled by Vite
// via the `?worker` import in App.tsx.
//
// Two request types:
//   * `choose` — return the best action for the current player. Used for
//     the AI's actual turn play and the hint-suggestion path.
//   * `analyze` — used by the post-game review. Given a position + the
//     action the player actually played, return the engine's best action
//     AND the eval after each, so the caller can compute "how much did
//     the player lose vs the engine's pick" and classify the move.

import { chooseAction, evaluate } from './ai';
import { reduce, type Action } from './reducer';
import type { GameState } from './types';

export type AiWorkerRequest = {
  // Each request carries an id so the main thread can ignore responses
  // for cancelled or stale requests (e.g., user starts a new game while
  // the worker is still thinking about the old state).
  id: number;
} & (
  | {
      type: 'choose';
      state: GameState;
      // Optional search-depth override from the difficulty selector.
      // Falls back to chooseAction's default if omitted.
      searchDepth?: number;
      // Optional time budget in milliseconds. The engine bails between
      // iterative-deepening iterations once the projected cost of the
      // next iteration exceeds the remaining budget — depth is the
      // hard cap, time is the soft cap, and the engine returns
      // whatever depth it actually reached.
      timeBudgetMs?: number;
    }
  | {
      type: 'analyze';
      state: GameState;
      playedAction: Action;
      searchDepth?: number;
    }
);

export type AiWorkerResponse = {
  id: number;
} & (
  | { type: 'action'; action: Action | null }
  | {
      type: 'analysis';
      bestAction: Action | null;
      bestEval: number;
      playedEval: number;
    }
);

self.addEventListener('message', (event: MessageEvent<AiWorkerRequest>) => {
  const msg = event.data;

  if (msg.type === 'choose') {
    const action = chooseAction(msg.state, msg.searchDepth, msg.timeBudgetMs);
    const response: AiWorkerResponse = { id: msg.id, type: 'action', action };
    (self as unknown as Worker).postMessage(response);
    return;
  }

  if (msg.type === 'analyze') {
    const mover = msg.state.currentPlayer;
    const bestAction = chooseAction(msg.state, msg.searchDepth);

    // Eval after the engine's recommended move. If the engine returns
    // null (e.g., no legal actions), fall back to evaluating the
    // current position from the mover's perspective.
    let bestEval = evaluate(msg.state, mover);
    if (bestAction) {
      try {
        const bestState = reduce(msg.state, bestAction);
        bestEval = evaluate(bestState, mover);
      } catch {
        // Engine returned an illegal action — shouldn't happen, but
        // don't crash the worker.
      }
    }

    // Eval after the action the player actually played. Wrap in
    // try/catch because the played action could be malformed if the
    // history was tampered with or recorded against a stale state.
    let playedEval = evaluate(msg.state, mover);
    try {
      const playedState = reduce(msg.state, msg.playedAction);
      playedEval = evaluate(playedState, mover);
    } catch {
      /* keep playedEval at the pre-move value */
    }

    const response: AiWorkerResponse = {
      id: msg.id,
      type: 'analysis',
      bestAction,
      bestEval,
      playedEval,
    };
    (self as unknown as Worker).postMessage(response);
  }
});
