import { useEffect, useReducer, useRef, useState } from 'react';
import Board, { type BoardTheme, type DeployCell, type Marker } from './Board';
import EndGameOverlay from './EndGameOverlay';
import GameToolbar from './GameToolbar';
import PieceTray from './PieceTray';
import AccountModal from './AccountModal';
import SettingsMenu from './SettingsMenu';
import Sidebar from './Sidebar';
import StatsModal from './StatsModal';
import StatusBar from './StatusBar';
import Daily from './Daily';
import type { ChatMessage } from './Chat';
import Tutorial from './Tutorial';
import { useAuthUser } from './game/auth';
import { useEntitlement } from './game/entitlements';
import { loadProfile, type Profile } from './game/profile';
import { recordGame, totalGameCount, type StatsMode } from './game/stats';
import {
  applyThemeToCssVars,
  loadThemeId,
  saveThemeId,
  THEMES,
  type ThemeId,
} from './game/themes';
import { chooseAction, evaluate, legalActions } from './game/ai';
import AiWorker from './game/aiWorker?worker';
import type { AiWorkerRequest, AiWorkerResponse } from './game/aiWorker';
import { supabase } from './game/supabase';
import {
  DEPLOY_COORDS,
  FLAG_COORDS,
  LAYER_ORDER,
  LIFT_CELLS,
  NEXUS_COORD,
  clockMsForOption,
  createInitialGameState,
  type ClockOptionId,
} from './game/constants';
import { legalMovesFor, pieceAt, sameCoord } from './game/moves';
import { reduce } from './game/reducer';
import { sounds } from './game/sound';
import { loadSession, saveSession, type Difficulty } from './game/storage';
import type { Coord, GameState, HistoryEntry, Layer, PieceId, PieceKind, Player, RoomState } from './game/types';
import { opponentOf } from './game/types';
import './App.css';

const AI_THINK_DELAY_MS = 600;

// Build a BoardTheme record for the currently selected visual theme.
// Layer kinds are tagged so Board.tsx can dispatch atmosphere by kind
// (the kind-specific decorations are constant; only the colors change).
function layerThemesFor(themeId: ThemeId): Record<Layer, BoardTheme> {
  const t = THEMES[themeId].layers;
  return {
    space:  { ...t.space,  kind: 'space'  },
    sky:    { ...t.sky,    kind: 'sky'    },
    ground: { ...t.ground, kind: 'ground' },
  };
}

const LAYER_NAMES: Record<Layer, string> = {
  space: 'Space / Empyrean',
  sky: 'Sky / Meridian',
  ground: 'Ground / Terran',
};

const PLAYERS: Player[] = ['p1', 'p2'];

const PIECE_SYMBOL: Record<PieceKind, string> = {
  captain: '♚', // ♚ king
  soldier: '♟', // ♟ pawn
  rover:   '♜', // ♜ rook
  pilot:   '♝', // ♝ bishop
};

const flagSymbol = (_layer: Layer): string => '⚑';

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
    const badge =
      bp.piece.kind === 'captain' && bp.piece.promotedFromSoldier ? '★' : undefined;
    markers.push({
      row: bp.coord.row,
      col: bp.coord.col,
      symbol: PIECE_SYMBOL[bp.piece.kind],
      kind: bp.piece.owner,
      badge,
      // Stable id lets React keep the same DOM element across moves so
      // CSS can animate the x/y transition rather than teleporting.
      id: bp.piece.id,
    });
  }

  return markers;
}

function deployCellsForLayer(layer: Layer): DeployCell[] {
  if (layer !== 'ground') return [];
  return PLAYERS.map((player) => ({
    row: DEPLOY_COORDS[player].row,
    col: DEPLOY_COORDS[player].col,
    player,
  }));
}

// Walks history backwards to find the most recent move/deploy. End-turn
// entries are skipped — they don't represent a piece moving and would
// otherwise hide the player's last actual action behind a turn boundary.
type LastMove = {
  fromLayer: Layer;
  from: { row: number; col: number };
  toLayer: Layer;
  to: { row: number; col: number };
};
function findLastMove(state: GameState): LastMove | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (h.kind === 'move') {
      return {
        fromLayer: h.from.layer,
        from: { row: h.from.row, col: h.from.col },
        toLayer: h.to.layer,
        to: { row: h.to.row, col: h.to.col },
      };
    }
    if (h.kind === 'deploy') {
      // Treat deploy as a degenerate move where from == to. The board
      // will render only the destination highlight (no arrow).
      return {
        fromLayer: h.coord.layer,
        from: { row: h.coord.row, col: h.coord.col },
        toLayer: h.coord.layer,
        to: { row: h.coord.row, col: h.coord.col },
      };
    }
  }
  return null;
}

// Computes which of the current player's on-board pieces are sitting on
// a square the opponent could move to next ply — i.e., immediate
// capture threats. Grouped by layer for the per-board renderer.
function computeThreats(state: GameState): Record<Layer, Array<{ row: number; col: number }>> {
  const result: Record<Layer, Array<{ row: number; col: number }>> = {
    ground: [],
    sky: [],
    space: [],
  };
  if (state.status.kind !== 'in-progress') return result;
  const opp = opponentOf(state.currentPlayer);
  const attacks = new Set<string>();
  for (const bp of state.onBoard) {
    if (bp.piece.owner !== opp) continue;
    for (const t of legalMovesFor(bp, state)) {
      attacks.add(`${t.layer}:${t.row}:${t.col}`);
    }
  }
  for (const bp of state.onBoard) {
    if (bp.piece.owner !== state.currentPlayer) continue;
    const key = `${bp.coord.layer}:${bp.coord.row}:${bp.coord.col}`;
    if (attacks.has(key)) {
      result[bp.coord.layer].push({ row: bp.coord.row, col: bp.coord.col });
    }
  }
  return result;
}

type Selection =
  | null
  | { kind: 'hand'; pieceId: PieceId }
  | { kind: 'board'; pieceId: PieceId };

// Read once at module load so initial state is hydrated synchronously.
const INITIAL_SESSION = loadSession();

// Maps a HistoryEntry to the right sound. Called when history grows by 1.
function playSoundFor(entry: HistoryEntry): void {
  if (entry.kind === 'deploy') {
    sounds.deploy();
    return;
  }
  if (entry.kind === 'end-turn') {
    sounds.endTurn();
    return;
  }
  // Move with optional capture / promotion / lift transit. Capture takes
  // precedence (it's the most narratively significant), then layer change,
  // then promotion, then a plain move click.
  if (entry.captured) sounds.capture();
  else if (entry.from.layer !== entry.to.layer) sounds.lift();
  else if (entry.promoted) sounds.promotion();
  else sounds.move();
}

export default function App() {
  const [state, dispatch] = useReducer(
    reduce,
    undefined,
    () => INITIAL_SESSION?.game ?? createInitialGameState(),
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [aiPlayer, setAiPlayer] = useState<Player | null>(
    INITIAL_SESSION?.aiPlayer ?? 'p2',
  );
  const [room, setRoom] = useState<RoomState | null>(
    INITIAL_SESSION?.room ?? null,
  );
  // Mirror of the lobby:global presence set, populated by Lobby and read
  // by Friends so its online dots reflect the same channel without
  // spinning up a duplicate subscription.
  const [lobbyOnlineIds, setLobbyOnlineIds] = useState<Set<string>>(new Set());
  // Multiplayer is always two human players — auto-clear AI as soon as
  // a room becomes active so AI vs. opponent can't accidentally fight
  // for the same seat. The SettingsMenu also disables the mode picker
  // while in a room as a belt-and-suspenders.
  useEffect(() => {
    if (room && aiPlayer !== null) setAiPlayer(null);
  }, [room, aiPlayer]);

  // Strip any "residual" local state on transition into a multiplayer
  // room. Without this, the previous solo / 2P game's pieces and turn
  // counter are visible for the 100–500ms it takes the server-state
  // fetch to replace the board — confusing to the user. Tracks the
  // previous room with a ref so we only reset on the *transition*,
  // not every render while in a room.
  const prevRoomRef = useRef<RoomState | null>(null);
  useEffect(() => {
    const prev = prevRoomRef.current;
    if (!prev && room) {
      // Just entered a room. The fetch effect below will overwrite
      // this with the actual server state in a moment, but in the
      // meantime show a clean board instead of yesterday's game.
      dispatch({ type: 'new-game' });
      setSelection(null);
    }
    prevRoomRef.current = room;
  }, [room]);
  // AI-suggested move shown when the user clicks Hint. Cleared
  // automatically when history advances (so it disappears the moment
  // they actually move, deploy, or end-turn).
  const [hint, setHint] = useState<{ from: Coord; to: Coord } | null>(null);
  // Multiplayer state-push status. `pushFailed` flips on whenever the
  // games.state update errors (network down, RLS hiccup, …); the UI
  // surfaces a banner with a manual retry. `pushNonce` is bumped by
  // Retry to force the push effect to re-run with the current state.
  const [pushFailed, setPushFailed] = useState(false);
  const [pushNonce, setPushNonce] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>(
    INITIAL_SESSION?.difficulty ?? 'hard',
  );
  // Time control selection — persisted in session. `'off'` means no
  // clock; `'5'` / `'10'` / `'30'` are minutes per side per game.
  const [clockOption, setClockOption] = useState<ClockOptionId>(
    INITIAL_SESSION?.clockOption ?? 'off',
  );
  // Whether to draw the red threat ring under pieces in capture range.
  // On by default — strong learning aid, especially for new players.
  // Persisted in localStorage so the choice survives refresh.
  const [showThreats, setShowThreats] = useState<boolean>(() => {
    try {
      return localStorage.getItem('3phor.showThreats.v1') !== '0';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('3phor.showThreats.v1', showThreats ? '1' : '0');
    } catch {
      // no-op — storage may be unavailable in private mode
    }
  }, [showThreats]);
  // Auth + profile state. The AccountModal handles sign-in (magic link)
  // and the first-time profile form; this component just keeps a local
  // copy of the loaded profile for the footer label and downstream use.
  const { user: authUser } = useAuthUser();
  // Plus entitlement gates the Expert AI difficulty. The hook subscribes
  // to realtime entitlement changes, so a fresh subscription unlocks
  // Expert mid-session and a cancellation re-locks it.
  const { hasIt: hasPlus } = useEntitlement('feature.plus');
  // If a session was saved at Expert and the user has since lost (or
  // never had) the Plus entitlement, silently fall back to Hard so the
  // AI doesn't run at depth 6 for someone outside the gate.
  useEffect(() => {
    if (difficulty === 'expert' && !hasPlus) {
      setDifficulty('hard');
    }
  }, [difficulty, hasPlus]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    loadProfile(authUser.id).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const [statsOpen, setStatsOpen] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>(() => loadThemeId());
  // Apply CSS variables for the selected theme. Runs on mount + on
  // every theme change so the rest of the UI (which uses var(--…))
  // updates without per-component plumbing.
  useEffect(() => {
    applyThemeToCssVars(themeId);
    saveThemeId(themeId);
  }, [themeId]);
  const layerThemes = layerThemesFor(themeId);

  // ELO: when an online MP game finishes, fire-and-forget the
  // apply-rating Edge Function. The function is idempotent (uses a
  // PRIMARY KEY on game_results) so both clients calling it is safe;
  // localStorage flag prevents redundant calls from the same client.
  useEffect(() => {
    if (!room) return;
    if (!supabase) return;
    if (state.status.kind === 'in-progress') return;
    const flag = `3phor.rating-applied.${room.code}`;
    try {
      if (localStorage.getItem(flag)) return;
    } catch {
      /* fall through */
    }
    const sb = supabase;
    sb.functions
      .invoke('apply-rating', { body: { room_code: room.code } })
      .then(() => {
        try {
          localStorage.setItem(flag, '1');
        } catch {
          /* ignore */
        }
        // Refresh local profile so the new rating shows up immediately.
        if (authUser) {
          loadProfile(authUser.id).then((p) => p && setProfile(p));
        }
      })
      .catch(() => {
        // Non-blocking — rating is a polish feature, never break gameplay.
      });
  }, [state.status.kind, room, authUser]);

  // Record a stats row exactly once per game completion. Compare the
  // previous status kind against the current — if it just transitioned
  // from in-progress to won/draw, we have a fresh result to log.
  const prevStatusKind = useRef(state.status.kind);
  useEffect(() => {
    const prev = prevStatusKind.current;
    const curr = state.status.kind;
    prevStatusKind.current = curr;
    if (prev === 'in-progress' && (curr === 'won' || curr === 'draw')) {
      // Determine the player's "side" for stats: 1P uses the non-AI side,
      // online MP uses the room role. 2P hot-seat isn't tracked because
      // both sides are the same human.
      let mode: StatsMode | null = null;
      let mySide: Player | null = null;
      if (room && room.status === 'playing') {
        mode = room.role === 'p1' ? 'online-ravens' : 'online-stags';
        mySide = room.role;
      } else if (aiPlayer) {
        // aiPlayer is the AI's slot, so my slot is the opposite.
        mySide = aiPlayer === 'p1' ? 'p2' : 'p1';
        mode = mySide === 'p1' ? '1p-ravens' : '1p-stags';
      }
      if (mode && mySide) {
        const result: 'win' | 'loss' | 'draw' =
          state.status.kind === 'draw'
            ? 'draw'
            : state.status.winner === mySide
              ? 'win'
              : 'loss';
        const reason:
          | 'nexus'
          | 'elimination'
          | 'resignation'
          | 'time-out'
          | 'turn-limit'
          | 'stalemate'
          | 'agreement' = state.status.reason;
        recordGame({
          when: new Date().toISOString(),
          mode,
          result,
          reason,
          turns: state.turnNumber,
        });
      }
    }
  }, [state.status, state.turnNumber, aiPlayer, room]);

  // Tutorial is shown once for first-time users — gated by a localStorage
  // flag. The "Tutorial" button in the help row re-opens it any time.
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('3phor.tutorial.v1.seen') !== '1';
    } catch {
      return false;
    }
  });
  const [dailyOpen, setDailyOpen] = useState(false);
  // Per-room chat messages. Ephemeral — no DB persistence — so a
  // refresh wipes the log. Cleared whenever the user enters a new room.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    setChatMessages([]);
  }, [room?.code]);
  const closeTutorial = () => {
    setTutorialOpen(false);
    try {
      localStorage.setItem('3phor.tutorial.v1.seen', '1');
    } catch {
      // Storage may be unavailable in private mode — fine to lose the flag.
    }
  };
  // Tracks whether a state change came from a remote sync, so the local
  // "push to Supabase" effect doesn't echo it back into a feedback loop.
  const remoteSyncInFlight = useRef(false);

  // Auto-save game state, AI mode, room, and difficulty (so a refresh
  // keeps everything intact). Selection state is transient and not persisted.
  useEffect(() => {
    saveSession({ game: state, aiPlayer, room, difficulty, clockOption });
  }, [state, aiPlayer, room, difficulty, clockOption]);

  // "Save your guest account" banner. Shown when:
  //   1. User is signed in as a guest (anon — no email)
  //   2. They've played 3+ tracked games (real investment)
  //   3. They haven't dismissed the banner before
  // Clicking the message opens AccountModal so they can link an email.
  // Re-evaluated whenever a game finishes (state.status flips).
  const [saveBannerDismissed, setSaveBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('3phor.save-banner.dismissed.v1') === '1';
    } catch {
      return false;
    }
  });
  const [gameCount, setGameCount] = useState(0);
  useEffect(() => {
    setGameCount(totalGameCount());
  }, [state.status.kind]);
  const showSaveBanner =
    !!authUser &&
    !authUser.email &&
    !saveBannerDismissed &&
    gameCount >= 3;
  const dismissSaveBanner = () => {
    setSaveBannerDismissed(true);
    try {
      localStorage.setItem('3phor.save-banner.dismissed.v1', '1');
    } catch {
      /* no-op */
    }
  };

  // Clock tick — when a game has a clock and is in-progress, fire a
  // tick-clock action every 100ms with the current wall-clock time so
  // the reducer can charge the active player real elapsed time. The
  // first tick after a new game / turn change just anchors lastTickAt
  // without charging anything (see applyTick).
  useEffect(() => {
    if (!state.clock) return;
    if (state.status.kind !== 'in-progress') return;
    const id = window.setInterval(() => {
      dispatch({ type: 'tick-clock', now: Date.now() });
    }, 100);
    return () => window.clearInterval(id);
  }, [state.clock, state.status.kind]);

  // Sound: when the history grows by exactly one entry, play the cue for
  // the latest action. Bulk increases (a multiplayer remote-sync that
  // hydrates 5 prior moves at once) are skipped so we don't dump 5 sounds.
  const prevHistoryLen = useRef(state.history.length);
  useEffect(() => {
    const len = state.history.length;
    if (len === prevHistoryLen.current + 1) {
      playSoundFor(state.history[len - 1]);
    }
    prevHistoryLen.current = len;
  }, [state.history.length, state.history]);

  // Win fanfare — fires once when the game ends.
  useEffect(() => {
    if (state.status.kind === 'won') sounds.win();
  }, [state.status.kind]);

  // Drop any stale hint as soon as the player acts (history advances) or
  // a new game starts. Otherwise the gold arrow would linger over the
  // wrong position.
  useEffect(() => {
    setHint(null);
  }, [state.history.length, state.status.kind]);

  // Multiplayer: when entering a room, hydrate local state from the row
  // in Supabase, then subscribe to realtime UPDATE events so the opponent's
  // moves arrive as state replacements. On unmount or leave, unsubscribe.
  useEffect(() => {
    if (!room) return;
    if (!supabase) return;

    // Capture a non-null reference so the cleanup closure still type-checks
    // after TypeScript loses narrowing.
    const sb = supabase;
    let mounted = true;

    sb
      .from('games')
      .select('state, p2_id')
      .eq('room_code', room.code)
      .single()
      .then(({ data, error }) => {
        if (!mounted || error || !data) return;
        remoteSyncInFlight.current = true;
        dispatch({ type: 'remote-sync', state: data.state as GameState });
        // If P2 has already joined by the time we hydrate, flip status.
        setRoom((prev) =>
          prev && data.p2_id && prev.status === 'waiting'
            ? { ...prev, status: 'playing' }
            : prev,
        );
        // Clear the flag on the next tick so the push effect (which runs
        // after this dispatch's re-render) doesn't echo this state back.
        setTimeout(() => {
          remoteSyncInFlight.current = false;
        }, 50);
      });

    const channel = sb
      .channel(`room:${room.code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `room_code=eq.${room.code}`,
        },
        (payload) => {
          const newRow = payload.new as {
            state: GameState;
            p2_id: string | null;
          };
          remoteSyncInFlight.current = true;
          dispatch({ type: 'remote-sync', state: newRow.state });
          // P2 joining flips the room from 'waiting' to 'playing' for P1.
          setRoom((prev) =>
            prev && newRow.p2_id && prev.status === 'waiting'
              ? { ...prev, status: 'playing' }
              : prev,
          );
          setTimeout(() => {
            remoteSyncInFlight.current = false;
          }, 50);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code]);

  // Multiplayer: push local state changes up to Supabase whenever they
  // originate locally (not from a remote sync). The `remoteSyncInFlight`
  // flag is set just before a remote-sync dispatch, so the immediately-
  // following push effect skips, breaking the loop.
  //
  // After a successful push, if the turn just passed to the OTHER player,
  // also fire-and-forget the notify-turn Edge Function so the opponent
  // gets a Web Push (when their browser has subscribed).
  const lastSyncedTurnPlayer = useRef<Player | null>(null);
  useEffect(() => {
    if (!room) return;
    if (!supabase) return;
    if (remoteSyncInFlight.current) return;
    const sb = supabase;
    sb.from('games')
      .update({ state })
      .eq('room_code', room.code)
      .then(({ error }) => {
        if (error) {
          // Network or RLS hiccup — surface a banner so the user knows
          // their move didn't reach the server. Without this they'd see
          // their local board update normally and only realize the
          // opponent never moved when they got stuck.
          setPushFailed(true);
          return;
        }
        setPushFailed(false);
        // Fire push only when the *current player after the local change*
        // is the opponent (i.e., my move ended my turn). Without this guard
        // we'd notify the opponent on every activation, including ones
        // they already know about.
        const opponentRole: Player = room.role === 'p1' ? 'p2' : 'p1';
        const currentTurnPlayer = state.currentPlayer;
        if (
          currentTurnPlayer === opponentRole &&
          lastSyncedTurnPlayer.current !== opponentRole
        ) {
          sb.from('games')
            .select('p1_id, p2_id')
            .eq('room_code', room.code)
            .single()
            .then(({ data }) => {
              if (!data) return;
              const recipientId = opponentRole === 'p1' ? data.p1_id : data.p2_id;
              if (!recipientId) return;
              sb.functions
                .invoke('notify-turn', {
                  body: {
                    recipient_user_id: recipientId,
                    room_code: room.code,
                    from_nickname: profile?.nickname ?? null,
                  },
                })
                .catch(() => {
                  // Best-effort — push is a nice-to-have, never block the game.
                });
            });
        }
        lastSyncedTurnPlayer.current = currentTurnPlayer;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, room?.code, pushNonce]);

  // Drop selection whenever the active player or game status changes.
  useEffect(() => {
    setSelection(null);
  }, [state.currentPlayer, state.status]);

  // Web Worker for AI search — kept alive across renders via ref so the
  // worker (and its in-memory transposition table) persists between turns.
  // Each request carries an incrementing id; responses for stale ids are
  // ignored (e.g., when the user starts a new game while AI is still
  // thinking about the previous state).
  const aiWorkerRef = useRef<Worker | null>(null);
  const aiRequestIdRef = useRef(0);
  if (aiWorkerRef.current === null && typeof window !== 'undefined') {
    aiWorkerRef.current = new AiWorker();
  }
  useEffect(() => {
    return () => {
      aiWorkerRef.current?.terminate();
      aiWorkerRef.current = null;
    };
  }, []);

  // AI loop: when it's the AI's turn and the game is in progress, send the
  // state to the worker and dispatch its chosen action when it comes back.
  // The effect re-runs after each dispatch (history grows / activations
  // change / turn flips), automatically scheduling the next AI activation.
  // When the turn passes back to the human, currentPlayer no longer matches
  // aiPlayer and the loop stops.
  //
  // Important: depend on game-progress signals, NOT the whole `state`. With
  // a clock running, applyTick produces a fresh state object every 100ms;
  // putting `state` here would cancel the AI_THINK_DELAY_MS timer below
  // before it could ever fire, leaving the AI permanently silent.
  // `stateRef` carries the latest state into the worker payload without
  // creating a re-run dependency.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (room) return;
    if (!aiPlayer) return;
    if (state.status.kind !== 'in-progress') return;
    if (state.currentPlayer !== aiPlayer) return;
    const worker = aiWorkerRef.current;
    if (!worker) return;

    const requestId = ++aiRequestIdRef.current;
    let cancelled = false;

    const handleMessage = (event: MessageEvent<AiWorkerResponse>) => {
      if (cancelled) return;
      if (event.data.id !== requestId) return;
      worker.removeEventListener('message', handleMessage);
      dispatch(event.data.action ?? { type: 'end-turn' });
    };
    worker.addEventListener('message', handleMessage);

    const timer = setTimeout(() => {
      if (cancelled) return;
      const searchDepth =
        difficulty === 'easy'
          ? 2
          : difficulty === 'medium'
            ? 3
            : difficulty === 'expert'
              ? 6
              : 4;
      const req: AiWorkerRequest = {
        id: requestId,
        type: 'choose',
        state: stateRef.current,
        searchDepth,
      };
      worker.postMessage(req);
    }, AI_THINK_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      worker.removeEventListener('message', handleMessage);
    };
  }, [
    aiPlayer,
    state.currentPlayer,
    state.status.kind,
    state.activationsRemaining,
    state.history.length,
    room,
    difficulty,
  ]);

  const inProgress = state.status.kind === 'in-progress';
  const isAiTurn = aiPlayer === state.currentPlayer && inProgress;
  // In multiplayer, only allow input when (a) the room is in 'playing'
  // state (both seats filled) and (b) it's our role's turn.
  const isMpBlocking =
    room !== null &&
    (room.status !== 'playing' || state.currentPlayer !== room.role);
  const isInputBlocked = isAiTurn || isMpBlocking;

  // End-of-turn is automatic — the End Turn button was removed from the
  // HUD. We dispatch `end-turn` after a short visible delay whenever the
  // human side has used both activations OR has no legal action left
  // (covering #6: a stuck player with no deploys/moves still ends turn
  // cleanly instead of locking the UI). The AI's loop handles its own
  // end-of-turn separately, so guard on !isAiTurn to avoid duplicates.
  // Same caveat as the AI effect above: do NOT depend on the full `state`,
  // or a running clock will cancel the 380ms timer on every tick and the
  // human's turn will never end.
  useEffect(() => {
    if (!inProgress) return;
    if (isAiTurn) return;
    if (isMpBlocking) return;
    const noActsLeft = state.activationsRemaining <= 0;
    const noLegal = !noActsLeft && legalActions(state).length === 0;
    if (!noActsLeft && !noLegal) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'end-turn' });
    }, 380);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.currentPlayer,
    state.activationsRemaining,
    state.history.length,
    inProgress,
    isAiTurn,
    isMpBlocking,
  ]);

  const selectedBoardPiece =
    selection?.kind === 'board'
      ? state.onBoard.find((bp) => bp.piece.id === selection.pieceId)
      : undefined;

  const selectedHandId = selection?.kind === 'hand' ? selection.pieceId : null;

  type TargetCell = { row: number; col: number; kind: 'move' | 'lift-up' | 'lift-down' };
  const legalTargetsByLayer: Record<Layer, TargetCell[]> = { ground: [], sky: [], space: [] };
  if (selectedBoardPiece) {
    const sourceLayer = selectedBoardPiece.coord.layer;
    const sourceIdx = LAYER_ORDER.indexOf(sourceLayer);
    for (const c of legalMovesFor(selectedBoardPiece, state)) {
      let kind: 'move' | 'lift-up' | 'lift-down' = 'move';
      if (c.layer !== sourceLayer) {
        // LAYER_ORDER is top-to-bottom (space, sky, ground), so a smaller
        // index means a higher layer.
        kind = LAYER_ORDER.indexOf(c.layer) < sourceIdx ? 'lift-up' : 'lift-down';
      }
      legalTargetsByLayer[c.layer].push({ row: c.row, col: c.col, kind });
    }
  }

  // Flash toast — short-lived hint shown when an action would silently
  // fail. Used to explain why a click "did nothing" instead of leaving
  // the player staring at the board (the #7 frustration: stuck pieces
  // and blocked deploy pads with no feedback).
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!flashMsg) return;
    const t = setTimeout(() => setFlashMsg(null), 3200);
    return () => clearTimeout(t);
  }, [flashMsg]);
  const flash = (msg: string) => setFlashMsg(msg);

  // Draw offer state. `outgoingDraw` is true while we're waiting for the
  // opponent to respond to a draw we sent (only used in MP). `incomingDraw`
  // is set when the opponent has offered a draw and we need to accept or
  // decline. Both clear automatically on any history change (a played
  // move implicitly declines a pending offer).
  const [outgoingDraw, setOutgoingDraw] = useState(false);
  const [incomingDraw, setIncomingDraw] = useState(false);
  useEffect(() => {
    setOutgoingDraw(false);
    setIncomingDraw(false);
  }, [state.history.length, state.status.kind]);

  // Per-room broadcast channel for draw offers (and future room-scoped
  // events: chat, takeback requests, etc.). Separate from the postgres-
  // changes subscription that syncs game state.
  const drawChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  useEffect(() => {
    if (!supabase || !room) return;
    const sb = supabase;
    const channel = sb.channel(`room:${room.code}`);
    drawChannelRef.current = channel;
    channel
      .on('broadcast', { event: 'draw-offer' }, ({ payload }) => {
        const from = (payload as { from?: Player } | undefined)?.from;
        if (from && from !== room.role) setIncomingDraw(true);
      })
      .on('broadcast', { event: 'draw-decline' }, ({ payload }) => {
        const from = (payload as { from?: Player } | undefined)?.from;
        if (from && from !== room.role) {
          setOutgoingDraw(false);
          flash('Opponent declined the draw offer.');
        }
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        const m = payload as ChatMessage | undefined;
        if (!m || typeof m.text !== 'string') return;
        // Append; both sides see the same broadcast so messages line up.
        setChatMessages((prev) => [...prev, m]);
      })
      .subscribe();
    return () => {
      channel.unsubscribe();
      drawChannelRef.current = null;
    };
  }, [room]);

  // Is the current player's deploy pad occupied (by any piece)? Used to
  // gate the pad's "drop me here" highlight and to flash a hint when the
  // player tries to deploy onto a blocked pad.
  const myDeployBlocked = inProgress
    ? pieceAt(state, DEPLOY_COORDS[state.currentPlayer]) !== undefined
    : false;

  const handleSelectHandPiece = (id: PieceId) => {
    if (isInputBlocked) return;
    setSelection((prev) =>
      prev?.kind === 'hand' && prev.pieceId === id ? null : { kind: 'hand', pieceId: id },
    );
    if (myDeployBlocked) {
      flash(
        'Your deploy pad is occupied — move that piece off the pad before deploying a new one.',
      );
    }
  };

  const handleDeployClick = (player: Player) => {
    if (!inProgress || isInputBlocked) return;
    if (player !== state.currentPlayer) return;
    if (selection?.kind !== 'hand') return;
    if (myDeployBlocked) {
      flash('Deploy pad is occupied. Move the piece off the pad first.');
      return;
    }
    dispatch({ type: 'deploy', pieceId: selection.pieceId });
    setSelection(null);
  };

  const handleCellClick = (layer: Layer, row: number, col: number) => {
    if (!inProgress || isInputBlocked) return;
    const target: Coord = { layer, row, col };

    // 1. If a board piece is selected and the click is a legal target → move.
    if (selectedBoardPiece) {
      const moves = legalMovesFor(selectedBoardPiece, state);
      if (moves.some((c) => sameCoord(c, target))) {
        dispatch({ type: 'move', pieceId: selectedBoardPiece.piece.id, to: target });
        setSelection(null);
        return;
      }
    }

    // 2. If the clicked cell holds the current player's piece → select it.
    //    Flash a hint if the piece has no legal destinations so the user
    //    knows their click registered but the piece is genuinely stuck.
    const occupant = pieceAt(state, target);
    if (occupant && occupant.piece.owner === state.currentPlayer) {
      setSelection({ kind: 'board', pieceId: occupant.piece.id });
      const moves = legalMovesFor(occupant, state);
      if (moves.length === 0) {
        flash(
          "That piece has no legal moves from here — try a different one, or use a lift.",
        );
      }
      return;
    }

    // 3. Otherwise, deselect.
    setSelection(null);
  };

  // Pad lights up only when (a) a hand piece is selected AND (b) the pad
  // is actually free. Avoids the silent-fail trap where the pad glows but
  // tapping it does nothing because something is sitting on it.
  const activeDeployPlayer: Player | null =
    selection?.kind === 'hand' && inProgress && !myDeployBlocked
      ? state.currentPlayer
      : null;

  // Per-player move note shown next to each tray label so each side has an
  // at-a-glance status (activations left, "waiting", win/lose) without
  // scrolling up to the HUD. Prefix tells the player WHO is acting:
  // "AI" when the slot is AI-controlled, "Player 1/2" in 2P hot-seat,
  // and "You" when it's the human's slot in 1P.
  const moveNote = (player: Player): string => {
    if (state.status.kind === 'won') {
      return state.status.winner === player ? 'won!' : 'lost';
    }
    if (state.status.kind === 'draw') {
      return 'draw';
    }
    if (state.currentPlayer !== player) return 'waiting';
    const acts = state.activationsRemaining;
    const actsLabel = `${acts} activation${acts === 1 ? '' : 's'} left`;
    let prefix: string;
    if (aiPlayer === player) {
      prefix = 'AI';
    } else if (aiPlayer === null) {
      // 2P hot-seat — label by player number.
      prefix = player === 'p1' ? 'Player 1' : 'Player 2';
    } else {
      prefix = 'You';
    }
    return `${prefix} · ${actsLabel}`;
  };

  const lastMove = findLastMove(state);
  const threats = showThreats
    ? computeThreats(state)
    : { space: [], sky: [], ground: [] };
  const renderBoard = (layer: Layer) => {
    const selectedCell =
      selectedBoardPiece && selectedBoardPiece.coord.layer === layer
        ? { row: selectedBoardPiece.coord.row, col: selectedBoardPiece.coord.col }
        : null;
    const lastMoveFrom =
      lastMove && lastMove.fromLayer === layer ? lastMove.from : null;
    const lastMoveTo =
      lastMove && lastMove.toLayer === layer ? lastMove.to : null;
    const hintFrom =
      hint && hint.from.layer === layer
        ? { row: hint.from.row, col: hint.from.col }
        : null;
    const hintTo =
      hint && hint.to.layer === layer
        ? { row: hint.to.row, col: hint.to.col }
        : null;
    return (
      <Board
        key={layer}
        theme={layerThemes[layer]}
        markers={markersForLayer(layer, state)}
        deployCells={deployCellsForLayer(layer)}
        activeDeployPlayer={layer === 'ground' ? activeDeployPlayer : null}
        onDeployCellClick={layer === 'ground' ? handleDeployClick : undefined}
        selectedCell={selectedCell}
        legalTargets={legalTargetsByLayer[layer]}
        onCellClick={(row, col) => handleCellClick(layer, row, col)}
        lastMoveFrom={lastMoveFrom}
        lastMoveTo={lastMoveTo}
        threatenedCells={threats[layer]}
        hintFrom={hintFrom}
        hintTo={hintTo}
      />
    );
  };

  return (
    <main className="app">
      {showSaveBanner && (
        <div
          className="save-banner"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            className="save-banner-message"
            onClick={() => setAccountOpen(true)}
            title="Link an email to save your guest account"
          >
            <strong>★ Save your guest account</strong> — link an email so your rating, stats, and friends survive a browser clear.
          </button>
          <button
            type="button"
            className="save-banner-dismiss"
            onClick={dismissSaveBanner}
            aria-label="Dismiss this reminder"
            title="Don't show again"
          >
            ×
          </button>
        </div>
      )}
      <header className="app-header">
        <img
          src="/3phor-mark.png"
          alt="3phor"
          className="app-logo"
          width={120}
          height={120}
        />
        <div className="app-header-actions">
          <a
            href="/"
            className="hud-btn app-header-site"
            title="Visit playskyflag.com — the public website"
          >
            playskyflag.com
          </a>
          <button
            type="button"
            className="hud-btn app-header-account"
            onClick={() => setAccountOpen(true)}
            title={authUser ? 'Manage your account' : 'Sign in for online play'}
          >
            {authUser
              ? `Account: ${profile?.nickname ?? authUser.email ?? 'signed in'}`
              : 'Sign in'}
          </button>
          <button
            type="button"
            className="hud-btn app-header-stats"
            onClick={() => setStatsOpen(true)}
            title="View your win/loss record and recent games"
          >
            Stats
          </button>
          <SettingsMenu
            aiPlayer={aiPlayer}
            onSetMode={setAiPlayer}
            difficulty={difficulty}
            onSetDifficulty={setDifficulty}
            themeId={themeId}
            onSetTheme={setThemeId}
            clockOption={clockOption}
            onSetClockOption={setClockOption}
            showThreats={showThreats}
            onSetShowThreats={setShowThreats}
            inMpRoom={room !== null}
            hasPlus={hasPlus}
          />
        </div>
      </header>
      <StatusBar state={state} aiPlayer={aiPlayer} />
      <GameToolbar
        gameOver={state.status.kind !== 'in-progress'}
        hintEnabled={
          state.status.kind === 'in-progress' &&
          aiPlayer !== state.currentPlayer &&
          (room === null ||
            (room.status === 'playing' && room.role === state.currentPlayer))
        }
        onRequestHint={() => {
          // Quick depth-2 search — deep enough to surface a sensible
          // idea, shallow enough to feel instant.
          const action = chooseAction(state, 2);
          if (!action) {
            flash('No legal moves available.');
            return;
          }
          if (action.type === 'end-turn') {
            flash('Suggestion: end your turn — no useful action found.');
            return;
          }
          if (action.type === 'deploy') {
            const pad = DEPLOY_COORDS[state.currentPlayer];
            setHint({ from: pad, to: pad });
            return;
          }
          if (action.type === 'move') {
            const bp = state.onBoard.find((b) => b.piece.id === action.pieceId);
            if (!bp) return;
            setHint({ from: bp.coord, to: action.to });
          }
        }}
        onOfferDraw={() => {
          // Mode-aware: MP broadcasts; 1P asks the AI's evaluator;
          // 2P hot-seat agrees instantly on confirm.
          if (room && drawChannelRef.current) {
            if (outgoingDraw) {
              flash('Already waiting for opponent to respond.');
              return;
            }
            setOutgoingDraw(true);
            drawChannelRef.current
              .send({
                type: 'broadcast',
                event: 'draw-offer',
                payload: { from: room.role },
              })
              .catch(() => undefined);
            flash('Draw offered — waiting for opponent.');
            return;
          }
          if (aiPlayer) {
            if (!confirm('Offer the AI a draw?')) return;
            const score = evaluate(state, aiPlayer);
            if (score > 100) {
              flash('The AI declines — it sees the position as winning for itself.');
            } else {
              dispatch({ type: 'agree-draw' });
            }
            return;
          }
          if (!confirm('Agree to a draw? The game ends with no winner.')) return;
          dispatch({ type: 'agree-draw' });
        }}
        onResign={() => {
          // Resigner is the local human on the clock — room.role in MP,
          // opposite-of-AI in 1P, current player in 2P hot-seat.
          const resigner: Player =
            room?.role ?? (aiPlayer ? (aiPlayer === 'p1' ? 'p2' : 'p1') : state.currentPlayer);
          dispatch({ type: 'resign', player: resigner });
        }}
        onNewGame={() => {
          if (room) {
            // Three cases in MP:
            //   (a) game already over → "play again in this room" — keep
            //       the room, reset state. Push effect updates games.state
            //       so the opponent's board flips to fresh too.
            //   (b) game in-progress → confirm leave (this is effectively
            //       a resign-and-leave from the user's POV).
            //   (c) waiting room with no opponent → confirm leave.
            const gameOver = state.status.kind !== 'in-progress';
            if (gameOver) {
              if (!confirm(`Start a new game in room ${room.code}?`)) return;
              dispatch({ type: 'new-game', clockMs: clockMsForOption(clockOption) });
              return;
            }
            const msg =
              room.status === 'waiting'
                ? `Leave room ${room.code} and start a new local game?`
                : `Starting a new game will leave room ${room.code}. Continue?`;
            if (!confirm(msg)) return;
            setRoom(null);
          }
          dispatch({ type: 'new-game', clockMs: clockMsForOption(clockOption) });
        }}
      />
      <Sidebar
        authUser={authUser}
        profile={profile}
        room={room}
        history={state.history}
        onlineIds={lobbyOnlineIds}
        aiPlayer={aiPlayer}
        onRoomEntered={setRoom}
        onLeaveRoom={() => setRoom(null)}
        onPresenceChange={setLobbyOnlineIds}
        onOpenTutorial={() => setTutorialOpen(true)}
        onOpenDaily={() => setDailyOpen(true)}
        chatMessages={chatMessages}
        onSendChat={(text: string) => {
          if (!room || !drawChannelRef.current) return false;
          const msg: ChatMessage = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            from: room.role,
            nickname: profile?.nickname ?? 'You',
            text,
            ts: Date.now(),
          };
          // Optimistic append so the sender sees their message
          // immediately; the broadcast echo for the OTHER side does
          // the same on their end. Self-echoes are dedup'd by id.
          setChatMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
          drawChannelRef.current
            .send({ type: 'broadcast', event: 'chat', payload: msg })
            .catch(() => undefined);
          return true;
        }}
      />
      <PieceTray
        player="p1"
        pieces={state.inHand.p1}
        capturedPieces={state.captured.p1}
        isInteractive={
          inProgress &&
          state.currentPlayer === 'p1' &&
          aiPlayer !== 'p1' &&
          (room === null || (room.status === 'playing' && room.role === 'p1'))
        }
        selectedId={selectedHandId}
        onSelect={handleSelectHandPiece}
        note={moveNote('p1')}
        clockMs={state.clock?.p1Ms}
        clockActive={
          state.clock !== undefined &&
          inProgress &&
          state.currentPlayer === 'p1'
        }
        flagsState={state.flags}
      />
      <div className="board-stack">
        {/* Flow design element FIRST in DOM so it paints behind the boards.
            Two subtle gradient curves: Ground↔Sky transitions green→blue,
            Sky↔Space transitions blue→purple. Bidirectional arrowheads
            indicate that lifts can travel in either direction. */}
        <svg
          className="layer-flow"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            {/* Burnished-bronze marker — a simple triangular tip,
                same color on both ends so the lift reads as
                bidirectional without the double-marker noise. */}
            <marker
              id="flow-arrow"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="3.2"
              markerHeight="3.2"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 Z" fill="#c89868" />
            </marker>
          </defs>
          {/* Ground ↔ Sky — anchored on the r5,c5 cell of each board
              (Terran's bottom-right cell ↔ Sky's bottom-right cell).
              The curve bulges OUT to the right to fill the empty
              wedge between Ground's right edge and Sky's bottom edge,
              never crossing through any board. Cell positions in the
              board-stack viewBox:
                Ground r5,c5 inner corner ≈ (65, 88)
                Sky    r5,c5 inner corner ≈ (94, 62) */}
          <path
            d="M 65 88 C 92 92, 102 76, 94 62"
            fill="none"
            stroke="#a0613f"
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.85}
            markerStart="url(#flow-arrow)"
            markerEnd="url(#flow-arrow)"
          />
          {/* Sky ↔ Space — anchored on the closest top corners of each
              board (Sky's r0,c0 ↔ Space's r0,c5) so the arc rides
              over the top without crossing Ground. Slightly cooler
              bronze (indigo undertone) for the higher / cosmic layer. */}
          <path
            d="M 68 2 Q 50 -10 32 2"
            fill="none"
            stroke="#7a5a8a"
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.85}
            markerStart="url(#flow-arrow)"
            markerEnd="url(#flow-arrow)"
          />
        </svg>
        {LAYER_ORDER.map((layer) => (
          <div className={`board-stack-item board-stack-item--${layer}`} key={layer}>
            <span className="board-stack-label">{LAYER_NAMES[layer]}</span>
            <div className="board-stack-tile">{renderBoard(layer)}</div>
          </div>
        ))}
      </div>
      <PieceTray
        player="p2"
        pieces={state.inHand.p2}
        capturedPieces={state.captured.p2}
        isInteractive={
          inProgress &&
          state.currentPlayer === 'p2' &&
          aiPlayer !== 'p2' &&
          (room === null || (room.status === 'playing' && room.role === 'p2'))
        }
        selectedId={selectedHandId}
        onSelect={handleSelectHandPiece}
        note={moveNote('p2')}
        clockMs={state.clock?.p2Ms}
        clockActive={
          state.clock !== undefined &&
          inProgress &&
          state.currentPlayer === 'p2'
        }
        flagsState={state.flags}
      />
      <EndGameOverlay
        state={state}
        user={authUser}
        room={room}
        onPlayAgain={() => {
          // From the end-of-game overlay: in MP, default to a fresh
          // game IN THE SAME ROOM (the natural "play again with same
          // opponent" flow); locally the state resets and the push
          // effect propagates to Supabase so the opponent's board
          // also flips to fresh.
          if (room) {
            if (state.status.kind !== 'in-progress') {
              dispatch({ type: 'new-game', clockMs: clockMsForOption(clockOption) });
              return;
            }
            const msg =
              room.status === 'waiting'
                ? `Leave room ${room.code} and start a new local game?`
                : `Starting a new game will leave room ${room.code}. Continue?`;
            if (!confirm(msg)) return;
            setRoom(null);
          }
          dispatch({ type: 'new-game', clockMs: clockMsForOption(clockOption) });
        }}
      />
      {flashMsg && (
        <div className="flash-toast" role="status" aria-live="polite">
          {flashMsg}
        </div>
      )}
      {pushFailed && room && (
        <div className="sync-banner" role="status" aria-live="polite">
          <span>⚠ Couldn't sync your last move to the server.</span>
          <button
            type="button"
            className="hud-btn hud-btn-subtle"
            onClick={() => setPushNonce((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {incomingDraw && room && (
        <div className="account-overlay" role="dialog" aria-modal="true">
          <div className="account-card">
            <h2 className="account-title">Draw offer</h2>
            <p className="account-intro">
              Your opponent is offering a draw. Accept and the game ends with
              no winner; decline and play continues.
            </p>
            <div className="account-actions">
              <button
                type="button"
                className="end-game-btn"
                onClick={() => {
                  dispatch({ type: 'agree-draw' });
                  setIncomingDraw(false);
                }}
              >
                Accept draw
              </button>
              <button
                type="button"
                className="end-game-btn end-game-btn--subtle"
                onClick={() => {
                  drawChannelRef.current
                    ?.send({
                      type: 'broadcast',
                      event: 'draw-decline',
                      payload: { from: room.role },
                    })
                    .catch(() => undefined);
                  setIncomingDraw(false);
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
      <Tutorial state={state} open={tutorialOpen} onClose={closeTutorial} />
      <Daily open={dailyOpen} onClose={() => setDailyOpen(false)} themeId={themeId} />
      <AccountModal
        user={authUser}
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onProfileChange={setProfile}
      />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <footer className="app-footer">
        <p>© 2026 Limnology Research Corp. · 3phor™ Kaleo Edition.</p>
        <p>
          Test feedback:{' '}
          <a href="mailto:njatel@limnology.ca?subject=3phor%20Test%20Feedback">
            njatel@limnology.ca
          </a>
        </p>
        <p className="app-footer-build">
          <button
            type="button"
            className="hud-btn hud-btn-subtle"
            onClick={() => {
              // Force a fresh fetch from the network so the user picks up
              // the latest deployed bundle. On iOS / Capacitor this reloads
              // the bundled web assets — TestFlight handles native updates.
              window.location.reload();
            }}
            title="Reload to get the latest version"
          >
            Check for updates
          </button>
          <span className="app-build-time">
            v{__GIT_SHA__} · Build {new Date(__BUILD_TIME__).toLocaleString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </p>
      </footer>
    </main>
  );
}
