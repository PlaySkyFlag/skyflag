// Post-game review — replays a finished game with engine analysis
// overlaid on each move. Mounted at /review/<slug> via main.tsx
// routing.
//
// Two ways the slug resolves:
//   * `/review/current` — reads the just-ended game from sessionStorage
//     (stashed by App.tsx when the user clicks "Review this game").
//     Used for 1P / 2P hot-seat games where no DB record exists.
//   * `/review/<room_code>` — fetches the game from Supabase by room
//     code. Used for online-MP games and tournament games. The full
//     history is included in games.state so the route is permalink-
//     able without any separate replay table.
//
// Boards re-use the same Board component the players see, with all
// click handlers omitted. A scrubber + move list let the viewer
// step through every ply with the engine's verdict next to it.

import { useEffect, useMemo, useState } from 'react';
import Board, { type BoardTheme, type Marker } from './Board';
import EvalGraph from './EvalGraph';
import {
  DEPLOY_COORDS,
  FLAG_COORDS,
  LAYER_ORDER,
  LIFT_CELLS,
  NEXUS_COORD,
} from './game/constants';
import {
  analyzeGame,
  CLASSIFICATION_LABEL,
  CLASSIFICATION_COLOR,
  summarizeAnalysis,
  type AnalysisProgress,
  type AnalysisResult,
  type Classification,
  type MoveAnalysis,
} from './game/review';
import { supabase } from './game/supabase';
import {
  applyThemeToCssVars,
  loadThemeId,
  THEMES,
  type ThemeId,
} from './game/themes';
import type {
  Action,
} from './game/reducer';
import type { Coord, GameState, HistoryEntry, Layer, PieceKind, Player } from './game/types';
import './App.css';

// ── Session storage shape ───────────────────────────────────────
// The "current game" handoff between App.tsx (where the game just
// ended) and Review.tsx (the /review/current route). Stored in
// sessionStorage so it survives the navigation but doesn't pollute
// long-term localStorage.
const REVIEW_SESSION_KEY = '3phor.review-session.v1';

export type ReviewSession = {
  history: HistoryEntry[];
  finalState: GameState;
  p1Nickname?: string;
  p2Nickname?: string;
  // Optional permalink slug — when the just-ended game was online
  // MP, the App stashes the room code here so the Review URL can
  // be shared with anyone.
  roomCode?: string;
};

export function stashReviewSession(session: ReviewSession): void {
  try {
    sessionStorage.setItem(REVIEW_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* private mode / quota — review just won't be available */
  }
}

function loadReviewSession(): ReviewSession | null {
  try {
    const raw = sessionStorage.getItem(REVIEW_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReviewSession;
  } catch {
    return null;
  }
}

// ── Board rendering helpers (mirrored from Watch.tsx) ──────────
const LAYER_NAMES: Record<Layer, string> = {
  space: 'Space / Empyrean',
  sky: 'Sky / Meridian',
  ground: 'Ground / Terran',
};

const PLAYERS: Player[] = ['p1', 'p2'];

const PIECE_SYMBOL: Record<PieceKind, string> = {
  captain: '♚',
  soldier: '♟',
  rover: '♜',
  pilot: '♝',
};

const flagSymbol = (_layer: Layer): string => '⚑';

function layerThemesFor(themeId: ThemeId): Record<Layer, BoardTheme> {
  const t = THEMES[themeId].layers;
  return {
    space: { ...t.space, kind: 'space' },
    sky: { ...t.sky, kind: 'sky' },
    ground: { ...t.ground, kind: 'ground' },
  };
}

function markersForLayer(layer: Layer, state: GameState): Marker[] {
  const markers: Marker[] = [];
  for (const cell of LIFT_CELLS) {
    markers.push({ row: cell.row, col: cell.col, symbol: '⬆', kind: 'lift' });
  }
  for (const player of PLAYERS) {
    if (!state.flags[layer][player]) {
      const pos = FLAG_COORDS[player][layer];
      markers.push({ row: pos.row, col: pos.col, symbol: flagSymbol(layer), kind: player });
    }
  }
  if (layer === 'space') {
    markers.push({ row: NEXUS_COORD.row, col: NEXUS_COORD.col, symbol: '◎', kind: 'nexus' });
  }
  for (const bp of state.onBoard) {
    if (bp.coord.layer !== layer) continue;
    const badge = bp.piece.kind === 'captain' && bp.piece.promotedFromSoldier ? '★' : undefined;
    markers.push({
      row: bp.coord.row,
      col: bp.coord.col,
      symbol: PIECE_SYMBOL[bp.piece.kind],
      kind: bp.piece.owner,
      badge,
      id: bp.piece.id,
    });
  }
  return markers;
}

function deployCellsFor(layer: Layer) {
  if (layer !== 'ground') return [];
  return PLAYERS.map((player) => ({
    row: DEPLOY_COORDS[player].row,
    col: DEPLOY_COORDS[player].col,
    player,
  }));
}

// Extract a from/to pair from an Action so we can highlight last
// move and engine-recommended move on the board.
function actionEndpoints(
  state: GameState,
  action: Action | null,
): { fromLayer: Layer | null; from: Coord | null; toLayer: Layer; to: Coord } | null {
  if (!action) return null;
  if (action.type === 'move') {
    const bp = state.onBoard.find((b) => b.piece.id === action.pieceId);
    if (!bp) return null;
    return {
      fromLayer: bp.coord.layer,
      from: bp.coord,
      toLayer: action.to.layer,
      to: action.to,
    };
  }
  if (action.type === 'deploy') {
    const player = state.currentPlayer;
    const coord = DEPLOY_COORDS[player];
    return {
      fromLayer: null,
      from: null,
      toLayer: coord.layer,
      to: coord,
    };
  }
  return null;
}

// ── Component ──────────────────────────────────────────────────
export default function Review() {
  // Pathname slug — `/review/current` or `/review/<roomCode>`.
  const slug = window.location.pathname
    .replace(/^\/review\/?/, '')
    .replace(/\/$/, '');

  const themeId = loadThemeId();
  useEffect(() => {
    applyThemeToCssVars(themeId);
  }, [themeId]);
  const layerThemes = useMemo(() => layerThemesFor(themeId), [themeId]);

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>({
    done: 0,
    total: 0,
    partial: [],
  });
  const [ply, setPly] = useState(0);

  // ── Source load ────────────────────────────────────────────
  // /review/current → sessionStorage handoff from EndGameOverlay
  // /review/<code>  → Supabase games row by room_code
  useEffect(() => {
    if (slug === 'current' || slug === '') {
      const s = loadReviewSession();
      if (!s) {
        setLoadError(
          "No recent game to review. Finish a game first, then click “Review this game”.",
        );
        return;
      }
      setSession(s);
      return;
    }
    if (!supabase) {
      setLoadError("Couldn't load this game — multiplayer isn't configured here.");
      return;
    }
    const sb = supabase;
    let mounted = true;
    sb.from('games')
      .select('state, p1_id, p2_id')
      .eq('room_code', slug.toUpperCase())
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error || !data) {
          setLoadError("Couldn't find a game with that code.");
          return;
        }
        const state = data.state as GameState;
        const ids = [data.p1_id, data.p2_id].filter(Boolean) as string[];
        const nameById = new Map<string, string>();
        if (ids.length > 0) {
          const { data: profs } = await sb
            .from('profiles')
            .select('id, nickname')
            .in('id', ids);
          for (const p of (profs ?? []) as { id: string; nickname: string }[]) {
            nameById.set(p.id, p.nickname);
          }
        }
        setSession({
          history: state.history,
          finalState: state,
          p1Nickname: data.p1_id ? nameById.get(data.p1_id) : undefined,
          p2Nickname: data.p2_id ? nameById.get(data.p2_id) : undefined,
          roomCode: slug.toUpperCase(),
        });
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  // ── Analyze once the session is loaded ─────────────────────
  useEffect(() => {
    if (!session) return;
    const ctrl = new AbortController();
    setProgress({ done: 0, total: 0, partial: [] });
    setResult(null);
    analyzeGame(session.history, {
      searchDepth: 4,
      onProgress: setProgress,
      signal: ctrl.signal,
    })
      .then(setResult)
      .catch((err) => {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.error('[review] analyze failed', err);
        }
      });
    return () => ctrl.abort();
  }, [session]);

  // ── Derived: current state at ply ──────────────────────────
  const positions = result?.positions ?? (session ? [] : []);
  const currentState: GameState | null =
    positions.length > 0
      ? positions[Math.min(ply, positions.length - 1)] ?? null
      : null;
  const totalPlies = positions.length > 0 ? positions.length - 1 : 0;

  // Analysis for the move that JUST happened to reach the current
  // ply (i.e., the action at ply - 1 in the history).
  const currentAnalysis: MoveAnalysis | null =
    result && ply > 0 ? result.byPly.get(ply - 1) ?? null : null;

  // Highlight overlays: green for the played move (the one that
  // produced the current position) and blue for the engine's pick.
  const lastMove = currentAnalysis
    ? actionEndpoints(positions[ply - 1], currentAnalysis.playedAction)
    : null;
  const bestMove = currentAnalysis
    ? actionEndpoints(positions[ply - 1], currentAnalysis.bestAction)
    : null;

  // ── Render ─────────────────────────────────────────────────
  if (loadError) {
    return (
      <main className="app review-app">
        <div className="watch-error">
          <h2>Couldn't load this review</h2>
          <p>{loadError}</p>
          <a href="/play" className="hud-btn">Back to the game</a>
        </div>
      </main>
    );
  }

  if (!session || !currentState) {
    return (
      <main className="app review-app">
        <p className="lobby-hint">Loading game…</p>
      </main>
    );
  }

  const isAnalyzing = !result && progress.total > 0;
  const summary = result ? summarizeAnalysis(result.analyses) : null;

  const p1Label = session.p1Nickname ?? 'Player 1';
  const p2Label = session.p2Nickname ?? 'Player 2';

  return (
    <main className="app review-app">
      <header className="app-header">
        <h1 className="watch-title">
          Game review
          {session.roomCode ? <span className="review-roomcode"> · room {session.roomCode}</span> : null}
        </h1>
        <p className="watch-sub">
          {p1Label} vs {p2Label}
        </p>
      </header>

      {/* Summary strip — totals per side */}
      {summary && (
        <div className="review-summary">
          <SummaryCol label={`${p1Label} (Grey Ravens)`} counts={summary.p1} />
          <SummaryCol label={`${p2Label} (White Stags)`} counts={summary.p2} />
        </div>
      )}

      {/* Progress bar while the worker is grinding through positions */}
      {isAnalyzing && (
        <div className="review-progress">
          Analyzing position {progress.done} / {progress.total}…
          <div className="review-progress-bar">
            <div
              className="review-progress-fill"
              style={{ width: `${Math.round((100 * progress.done) / Math.max(1, progress.total))}%` }}
            />
          </div>
        </div>
      )}

      <div className="board-stack">
        {LAYER_ORDER.map((layer) => {
          const lastFromLayer = lastMove?.fromLayer === layer ? lastMove.from : null;
          const lastToLayer = lastMove?.toLayer === layer ? lastMove.to : null;
          const bestFromLayer = bestMove?.fromLayer === layer ? bestMove.from : null;
          const bestToLayer = bestMove?.toLayer === layer ? bestMove.to : null;
          return (
            <div className={`board-stack-item board-stack-item--${layer}`} key={layer}>
              <span className="board-stack-label">{LAYER_NAMES[layer]}</span>
              <div className="board-stack-tile">
                <Board
                  theme={layerThemes[layer]}
                  markers={markersForLayer(layer, currentState)}
                  deployCells={deployCellsFor(layer)}
                  activeDeployPlayer={null}
                  selectedCell={null}
                  legalTargets={[]}
                  onCellClick={() => undefined}
                  lastMoveFrom={lastFromLayer ? { row: lastFromLayer.row, col: lastFromLayer.col } : null}
                  lastMoveTo={lastToLayer ? { row: lastToLayer.row, col: lastToLayer.col } : null}
                  hintFrom={bestFromLayer ? { row: bestFromLayer.row, col: bestFromLayer.col } : null}
                  hintTo={bestToLayer ? { row: bestToLayer.row, col: bestToLayer.col } : null}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Eval graph — p1-perspective evaluation over time. Click to
          jump the scrubber to that move. Renders even while analysis
          is in progress (uses the streamed partial array). */}
      <EvalGraph
        analyses={result?.analyses ?? progress.partial}
        currentPly={ply}
        onPlyClick={setPly}
      />

      {/* Annotation for the current move */}
      <div className="review-annotation">
        {currentAnalysis ? (
          <ClassifiedAnnotation
            analysis={currentAnalysis}
            ply={ply}
            playerLabel={currentAnalysis.mover === 'p1' ? p1Label : p2Label}
          />
        ) : ply === 0 ? (
          <p>Starting position — use the scrubber to step through the game.</p>
        ) : (
          <p>End of game.</p>
        )}
      </div>

      {/* Scrubber */}
      <div className="review-scrubber">
        <button type="button" className="hud-btn" onClick={() => setPly(0)} disabled={ply === 0}>
          ⏮ First
        </button>
        <button
          type="button"
          className="hud-btn"
          onClick={() => setPly((p) => Math.max(0, p - 1))}
          disabled={ply === 0}
        >
          ◀ Prev
        </button>
        <input
          type="range"
          min={0}
          max={totalPlies}
          value={ply}
          onChange={(e) => setPly(Number(e.target.value))}
          className="review-slider"
          aria-label="Move scrubber"
        />
        <button
          type="button"
          className="hud-btn"
          onClick={() => setPly((p) => Math.min(totalPlies, p + 1))}
          disabled={ply >= totalPlies}
        >
          Next ▶
        </button>
        <button
          type="button"
          className="hud-btn"
          onClick={() => setPly(totalPlies)}
          disabled={ply >= totalPlies}
        >
          Last ⏭
        </button>
        <span className="review-ply-counter">
          Ply {ply} / {totalPlies}
        </span>
      </div>

      {/* Move list */}
      {result && (
        <div className="review-movelist">
          <h3 className="review-movelist-title">Moves</h3>
          <ol className="review-movelist-ol">
            {result.analyses.map((a) => (
              <li
                key={a.ply}
                className={`review-move-row ${a.ply + 1 === ply ? 'review-move-row-active' : ''}`}
                onClick={() => setPly(a.ply + 1)}
              >
                <span className={`review-move-pip review-move-pip-${a.mover}`} aria-hidden />
                <span className="review-move-num">{a.ply + 1}.</span>
                <span className="review-move-desc">{describeAction(a.playedAction, a.playedEntry)}</span>
                <span
                  className="review-move-class"
                  data-class={a.classification}
                  style={{ color: CLASSIFICATION_COLOR[a.classification] }}
                >
                  {CLASSIFICATION_LABEL[a.classification]}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <footer className="app-footer">
        <p>
          <a href="/play">← Back to the game</a>
          {session.roomCode ? <> · <a href={`/watch/${session.roomCode}`}>Watch live</a></> : null}
        </p>
      </footer>
    </main>
  );
}

function SummaryCol({
  label,
  counts,
}: {
  label: string;
  counts: Record<Classification, number>;
}) {
  return (
    <div className="review-summary-col">
      <strong className="review-summary-label">{label}</strong>
      <div className="review-summary-row">
        {(['best', 'good', 'inaccuracy', 'mistake', 'blunder'] as const).map((c) => (
          <span key={c} className="review-summary-cell" style={{ color: CLASSIFICATION_COLOR[c] }}>
            <strong>{counts[c]}</strong> {CLASSIFICATION_LABEL[c]}
          </span>
        ))}
      </div>
    </div>
  );
}

function ClassifiedAnnotation({
  analysis,
  ply,
  playerLabel,
}: {
  analysis: MoveAnalysis;
  ply: number;
  playerLabel: string;
}) {
  const isBest =
    analysis.classification === 'best' || analysis.evalLoss < 10;
  return (
    <div className="review-annotation-inner">
      <div className="review-annotation-line">
        <strong style={{ color: CLASSIFICATION_COLOR[analysis.classification] }}>
          {CLASSIFICATION_LABEL[analysis.classification]}
        </strong>
        <span className="review-annotation-detail">
          {' '}— {playerLabel} played{' '}
          <code>{describeAction(analysis.playedAction, analysis.playedEntry)}</code>
          {analysis.evalLoss > 0 && (
            <> (lost {Math.round(analysis.evalLoss)} eval)</>
          )}
          .
        </span>
      </div>
      {!isBest && analysis.bestAction && (
        <div className="review-annotation-line">
          <span className="review-annotation-best">
            Engine pick: <code>{describeAction(analysis.bestAction, null)}</code>
          </span>
        </div>
      )}
      <div className="review-annotation-meta">
        Ply {ply} · eval {Math.round(analysis.playedEval)} (best {Math.round(analysis.bestEval)})
      </div>
    </div>
  );
}

// Human-friendly Action label. Prefers the descriptive HistoryEntry
// when available (it carries piece kind directly); falls back to
// inferring from the Action for engine-recommended moves where no
// HistoryEntry exists.
function describeAction(action: Action, entry: HistoryEntry | null): string {
  if (entry) {
    if (entry.kind === 'deploy') {
      return `Deploy ${entry.pieceKind}`;
    }
    if (entry.kind === 'move') {
      const cap = entry.captured ? ` ×${entry.captured.kind}` : '';
      const flag = entry.flagCaptured ? ` ⚑${entry.flagCaptured.layer}` : '';
      const promo = entry.promoted ? ' ★' : '';
      return `${entry.pieceKind} → ${entry.to.layer[0].toUpperCase()}${entry.to.row},${entry.to.col}${cap}${flag}${promo}`;
    }
    return 'End turn';
  }
  // Engine pick — no entry to read from.
  if (action.type === 'deploy') return 'Deploy';
  if (action.type === 'move')
    return `Move → ${action.to.layer[0].toUpperCase()}${action.to.row},${action.to.col}`;
  return action.type;
}
