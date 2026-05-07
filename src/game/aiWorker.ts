// Web Worker entry — runs the minimax search on a background thread so the
// UI stays responsive while the AI thinks. The main thread posts a state,
// the worker computes the best action, and posts it back. Bundled by Vite
// via the `?worker` import in App.tsx.

import { chooseAction } from './ai';
import type { Action } from './reducer';
import type { GameState } from './types';

export type AiWorkerRequest = {
  // Each request carries an id so the main thread can ignore responses
  // for cancelled or stale requests (e.g., user starts a new game while
  // the worker is still thinking about the old state).
  id: number;
  type: 'choose';
  state: GameState;
  // Optional search-depth override from the difficulty selector.
  // Falls back to chooseAction's default if omitted.
  searchDepth?: number;
};

export type AiWorkerResponse = {
  id: number;
  type: 'action';
  action: Action | null;
};

self.addEventListener('message', (event: MessageEvent<AiWorkerRequest>) => {
  const msg = event.data;
  if (msg.type !== 'choose') return;
  const action = chooseAction(msg.state, msg.searchDepth);
  const response: AiWorkerResponse = { id: msg.id, type: 'action', action };
  (self as unknown as Worker).postMessage(response);
});
