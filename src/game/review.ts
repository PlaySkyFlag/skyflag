// Post-game review — replays a finished game's history through the
// reducer to reconstruct every intermediate position, then asks the
// AI worker to analyze each player decision against what the engine
// would have played.
//
// Output is a list of MoveAnalysis records, one per non-end-turn
// action. Each carries:
//   - the played action and the engine's recommended action
//   - the eval after each (from the mover's perspective)
//   - how much eval was lost by the choice (≥ 0)
//   - a classification (best / good / inaccuracy / mistake / blunder)
//
// Classification thresholds are calibrated to 3phor's current eval
// scale (Captain=700, flag=200, soldier=120). Starting values; tunable
// once we have real game data to look at.
//
// The worker is spun up fresh per analyzeGame() call and torn down
// when done — analysis happens once per Review session, so a long-
// lived worker isn't worth the lifecycle complexity.

import { createInitialGameState } from './constants';
import { reduce, type Action } from './reducer';
import type { AiWorkerRequest, AiWorkerResponse } from './aiWorker';
import AiWorker from './aiWorker?worker';
import type { GameState, HistoryEntry, Player } from './types';

export type Classification = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export type MoveAnalysis = {
  // Index into the original history array — lets the UI line up
  // analyses with the move-history view.
  ply: number;
  mover: Player;
  playedEntry: HistoryEntry;
  playedAction: Action;
  bestAction: Action | null;
  playedEval: number;
  bestEval: number;
  // Always ≥ 0 — clamped to zero if the engine's "best" eval is
  // actually worse than what the player chose (can happen at low
  // depth due to horizon effects).
  evalLoss: number;
  classification: Classification;
};

export type AnalysisResult = {
  // All reconstructed positions, oldest first. Length = history.length + 1
  // (one position before the first action, one after each subsequent).
  positions: GameState[];
  analyses: MoveAnalysis[];
  // Convenience map: ply → analysis, so the scrubber can look up the
  // current analysis without filtering an array on every render.
  byPly: Map<number, MoveAnalysis>;
};

export type AnalysisProgress = {
  done: number;
  total: number;
  // Streaming snapshot of analyses computed so far.
  partial: MoveAnalysis[];
};

// Convert a HistoryEntry (descriptive: piece kind + coords) back into
// an Action (operational: piece id + coord). The conversion needs the
// state at the time of the action so it can find the actual piece id —
// pieces of the same kind in hand are interchangeable for replay
// purposes, so we just pick the first matching one.
export function historyEntryToAction(
  state: GameState,
  entry: HistoryEntry,
): Action | null {
  if (entry.kind === 'deploy') {
    const piece = state.inHand[entry.player].find((p) => p.kind === entry.pieceKind);
    if (!piece) return null;
    return { type: 'deploy', pieceId: piece.id };
  }
  if (entry.kind === 'move') {
    const bp = state.onBoard.find(
      (b) =>
        b.coord.layer === entry.from.layer &&
        b.coord.row === entry.from.row &&
        b.coord.col === entry.from.col &&
        b.piece.owner === entry.player,
    );
    if (!bp) return null;
    return { type: 'move', pieceId: bp.piece.id, to: entry.to };
  }
  // end-turn
  return { type: 'end-turn' };
}

// Drive the reducer forward from a fresh initial state, applying
// each history entry. Returns the list of positions — index N is the
// state AFTER history[N - 1] was applied (index 0 is the initial).
export function replayGame(history: HistoryEntry[]): GameState[] {
  const positions: GameState[] = [createInitialGameState()];
  let state = positions[0];
  for (const entry of history) {
    const action = historyEntryToAction(state, entry);
    if (!action) break;
    try {
      state = reduce(state, action);
    } catch {
      // If the history can't be replayed (corrupted, mismatched
      // reducer version, etc.), stop here — the caller will only
      // analyze the positions we could reach.
      break;
    }
    positions.push(state);
  }
  return positions;
}

// Move classification. Thresholds are 3phor-tuned (smaller pieces
// than chess): a 200-point loss is genuinely a mistake, 500+ usually
// means hanging a Captain or letting through a final flag.
export function classify(evalLoss: number, isEngineMatch: boolean): Classification {
  if (isEngineMatch) return 'best';
  if (evalLoss < 30) return 'best';
  if (evalLoss < 80) return 'good';
  if (evalLoss < 200) return 'inaccuracy';
  if (evalLoss < 500) return 'mistake';
  return 'blunder';
}

function actionsEqual(a: Action | null, b: Action | null): boolean {
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  if (a.type === 'deploy' && b.type === 'deploy') {
    return a.pieceId === b.pieceId;
  }
  if (a.type === 'move' && b.type === 'move') {
    return (
      a.pieceId === b.pieceId &&
      a.to.layer === b.to.layer &&
      a.to.row === b.to.row &&
      a.to.col === b.to.col
    );
  }
  return a.type === b.type;
}

// Build the list of positions we actually need to analyze — skips
// end-turn entries (no decision to evaluate) and terminal positions.
type AnalysisTask = {
  ply: number;
  state: GameState;
  entry: HistoryEntry;
  action: Action;
};

function buildTasks(
  history: HistoryEntry[],
  positions: GameState[],
): AnalysisTask[] {
  const tasks: AnalysisTask[] = [];
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    if (entry.kind === 'end-turn') continue;
    const stateBefore = positions[i];
    if (!stateBefore || stateBefore.status.kind !== 'in-progress') continue;
    const action = historyEntryToAction(stateBefore, entry);
    if (!action || action.type === 'end-turn') continue;
    tasks.push({ ply: i, state: stateBefore, entry, action });
  }
  return tasks;
}

// Main entry. Spawns a worker, processes positions one at a time,
// posts incremental progress, returns the full AnalysisResult.
//
// Cancellation: pass an AbortSignal to allow the caller to cancel
// mid-analysis (e.g., the user navigates away from the review page).
// The worker is terminated immediately on abort.
export async function analyzeGame(
  history: HistoryEntry[],
  options: {
    searchDepth?: number;
    onProgress?: (p: AnalysisProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<AnalysisResult> {
  const { searchDepth = 4, onProgress, signal } = options;
  const positions = replayGame(history);
  const tasks = buildTasks(history, positions);

  const analyses: MoveAnalysis[] = [];
  onProgress?.({ done: 0, total: tasks.length, partial: [] });

  if (tasks.length === 0) {
    return { positions, analyses, byPly: new Map() };
  }

  const worker = new AiWorker();
  let nextId = 1;

  const cleanup = () => {
    worker.terminate();
  };
  signal?.addEventListener('abort', cleanup, { once: true });

  try {
    for (const task of tasks) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const result = await new Promise<{
        bestAction: Action | null;
        bestEval: number;
        playedEval: number;
      }>((resolve, reject) => {
        const id = nextId++;
        const onMessage = (e: MessageEvent<AiWorkerResponse>) => {
          const msg = e.data;
          if (msg.id !== id) return;
          worker.removeEventListener('message', onMessage);
          if (msg.type === 'analysis') {
            resolve({
              bestAction: msg.bestAction,
              bestEval: msg.bestEval,
              playedEval: msg.playedEval,
            });
          } else {
            reject(new Error(`unexpected response type ${msg.type}`));
          }
        };
        worker.addEventListener('message', onMessage);
        const req: AiWorkerRequest = {
          id,
          type: 'analyze',
          state: task.state,
          playedAction: task.action,
          searchDepth,
        };
        worker.postMessage(req);
      });

      const evalLoss = Math.max(0, result.bestEval - result.playedEval);
      const analysis: MoveAnalysis = {
        ply: task.ply,
        mover: task.state.currentPlayer,
        playedEntry: task.entry,
        playedAction: task.action,
        bestAction: result.bestAction,
        playedEval: result.playedEval,
        bestEval: result.bestEval,
        evalLoss,
        classification: classify(evalLoss, actionsEqual(result.bestAction, task.action)),
      };
      analyses.push(analysis);

      onProgress?.({ done: analyses.length, total: tasks.length, partial: [...analyses] });
    }
  } finally {
    cleanup();
    signal?.removeEventListener('abort', cleanup);
  }

  const byPly = new Map<number, MoveAnalysis>();
  for (const a of analyses) byPly.set(a.ply, a);

  return { positions, analyses, byPly };
}

// ── Display helpers ──────────────────────────────────────────────
// Pretty labels for the classification badge.
export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  best: '★ Best',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: '⚠ Blunder',
};

// Tailwind-free color tokens — the Review CSS will pick these up
// via [data-class="..."] attribute selectors.
export const CLASSIFICATION_COLOR: Record<Classification, string> = {
  best: '#7be0a3',
  good: '#a8c8ff',
  inaccuracy: '#ffd884',
  mistake: '#ff9a5a',
  blunder: '#ff6b6b',
};

// Game summary — top-line stats across the whole analysis. Used in
// the review header ("You played 12 best, 3 mistakes, 1 blunder").
export type GameSummary = Record<Player, Record<Classification, number>>;

export function summarizeAnalysis(analyses: MoveAnalysis[]): GameSummary {
  const empty = (): Record<Classification, number> => ({
    best: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  });
  const out: GameSummary = { p1: empty(), p2: empty() };
  for (const a of analyses) {
    out[a.mover][a.classification] += 1;
  }
  return out;
}
