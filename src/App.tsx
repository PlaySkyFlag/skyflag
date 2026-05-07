import { useEffect, useReducer, useRef, useState } from 'react';
import Board, { type BoardTheme, type DeployCell, type Marker } from './Board';
import EndGameOverlay from './EndGameOverlay';
import Help from './Help';
import MoveHistory from './MoveHistory';
import Multiplayer from './Multiplayer';
import PieceTray from './PieceTray';
import StatusBar from './StatusBar';
import { chooseAction } from './game/ai';
import { supabase } from './game/supabase';
import {
  DEPLOY_COORDS,
  FLAG_COORDS,
  LAYER_ORDER,
  LIFT_CELLS,
  NEXUS_COORD,
  createInitialGameState,
} from './game/constants';
import { legalMovesFor, pieceAt, sameCoord } from './game/moves';
import { reduce } from './game/reducer';
import { sounds } from './game/sound';
import { loadSession, saveSession } from './game/storage';
import type { Coord, GameState, HistoryEntry, Layer, PieceId, PieceKind, Player, RoomState } from './game/types';
import './App.css';

const AI_THINK_DELAY_MS = 600;

const SPACE_THEME: BoardTheme = {
  lightFill: '#5b5f9a',
  darkFill: '#3a3d6b',
  background: '#15172e',
  stroke: '#0a0b1c',
  label: '#9ea4cf',
};

const SKY_THEME: BoardTheme = {
  lightFill: '#bcdcef',
  darkFill: '#7eb3d4',
  background: '#2a4860',
  stroke: '#163040',
  label: '#a8c4d8',
};

const GROUND_THEME: BoardTheme = {
  lightFill: '#a8c48f',
  darkFill: '#6b8e5a',
  background: '#1f2a17',
  stroke: '#2d3b25',
  label: '#a4b89a',
};

const LAYER_THEMES: Record<Layer, BoardTheme> = {
  space: SPACE_THEME,
  sky: SKY_THEME,
  ground: GROUND_THEME,
};

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
  // Tracks whether a state change came from a remote sync, so the local
  // "push to Supabase" effect doesn't echo it back into a feedback loop.
  const remoteSyncInFlight = useRef(false);

  // Auto-save game state, AI mode, and room (so a refresh keeps you in
  // the same Supabase room). Selection state is transient and not persisted.
  useEffect(() => {
    saveSession({ game: state, aiPlayer, room });
  }, [state, aiPlayer, room]);

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
  useEffect(() => {
    if (!room) return;
    if (!supabase) return;
    if (remoteSyncInFlight.current) return;
    supabase
      .from('games')
      .update({ state })
      .eq('room_code', room.code)
      .then();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, room?.code]);

  // Drop selection whenever the active player or game status changes.
  useEffect(() => {
    setSelection(null);
  }, [state.currentPlayer, state.status]);

  // AI loop: when it's the AI's turn and the game is in progress, pick an
  // action and dispatch it after a small visible delay. The effect re-runs
  // after each dispatch (state changes), automatically scheduling the next
  // AI activation. When the turn passes back to the human, currentPlayer
  // no longer matches aiPlayer and the loop stops.
  useEffect(() => {
    if (room) return;
    if (!aiPlayer) return;
    if (state.status.kind !== 'in-progress') return;
    if (state.currentPlayer !== aiPlayer) return;

    const timer = setTimeout(() => {
      const action = chooseAction(state);
      dispatch(action ?? { type: 'end-turn' });
    }, AI_THINK_DELAY_MS);

    return () => clearTimeout(timer);
  }, [aiPlayer, state, room]);

  const inProgress = state.status.kind === 'in-progress';
  const isAiTurn = aiPlayer === state.currentPlayer && inProgress;
  // In multiplayer, only allow input when (a) the room is in 'playing'
  // state (both seats filled) and (b) it's our role's turn.
  const isMpBlocking =
    room !== null &&
    (room.status !== 'playing' || state.currentPlayer !== room.role);
  const isInputBlocked = isAiTurn || isMpBlocking;

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

  const handleSelectHandPiece = (id: PieceId) => {
    if (isInputBlocked) return;
    setSelection((prev) => (prev?.kind === 'hand' && prev.pieceId === id ? null : { kind: 'hand', pieceId: id }));
  };

  const handleDeployClick = (player: Player) => {
    if (!inProgress || isInputBlocked) return;
    if (player !== state.currentPlayer) return;
    if (selection?.kind !== 'hand') return;
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
    const occupant = pieceAt(state, target);
    if (occupant && occupant.piece.owner === state.currentPlayer) {
      setSelection({ kind: 'board', pieceId: occupant.piece.id });
      return;
    }

    // 3. Otherwise, deselect.
    setSelection(null);
  };

  const activeDeployPlayer: Player | null =
    selection?.kind === 'hand' && inProgress ? state.currentPlayer : null;

  // Per-player move note shown next to each tray label so each side has an
  // at-a-glance status ("2 activations left", "waiting", "AI moving…",
  // win/lose) without scrolling up to the HUD.
  const moveNote = (player: Player): string => {
    if (state.status.kind === 'won') {
      return state.status.winner === player ? 'won!' : 'lost';
    }
    if (state.status.kind === 'draw') {
      return 'draw';
    }
    if (state.currentPlayer !== player) return 'waiting';
    if (aiPlayer === player) return 'AI moving…';
    const acts = state.activationsRemaining;
    return `${acts} activation${acts === 1 ? '' : 's'} left`;
  };

  const renderBoard = (layer: Layer) => {
    const selectedCell =
      selectedBoardPiece && selectedBoardPiece.coord.layer === layer
        ? { row: selectedBoardPiece.coord.row, col: selectedBoardPiece.coord.col }
        : null;
    return (
      <Board
        key={layer}
        theme={LAYER_THEMES[layer]}
        markers={markersForLayer(layer, state)}
        deployCells={deployCellsForLayer(layer)}
        activeDeployPlayer={layer === 'ground' ? activeDeployPlayer : null}
        onDeployCellClick={layer === 'ground' ? handleDeployClick : undefined}
        selectedCell={selectedCell}
        legalTargets={legalTargetsByLayer[layer]}
        onCellClick={(row, col) => handleCellClick(layer, row, col)}
      />
    );
  };

  return (
    <main className="app">
      <h1>SkyFlag</h1>
      <StatusBar
        state={state}
        aiPlayer={aiPlayer}
        onSetMode={setAiPlayer}
        onEndTurn={() => {
          if (isInputBlocked) return;
          dispatch({ type: 'end-turn' });
        }}
        onNewGame={() => dispatch({ type: 'new-game' })}
      />
      <div className="help-row">
        <Help />
        <Multiplayer
          room={room}
          onRoomEntered={setRoom}
          onLeave={() => setRoom(null)}
        />
        <MoveHistory history={state.history} />
      </div>
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
            <linearGradient
              id="flow-ground-sky"
              gradientUnits="userSpaceOnUse"
              x1="66"
              y1="72"
              x2="78"
              y2="64"
            >
              <stop offset="0%" stopColor="#7ba868" />
              <stop offset="100%" stopColor="#7eb3d4" />
            </linearGradient>
            <linearGradient
              id="flow-sky-space"
              gradientUnits="userSpaceOnUse"
              x1="68"
              y1="16"
              x2="32"
              y2="16"
            >
              <stop offset="0%" stopColor="#7eb3d4" />
              <stop offset="100%" stopColor="#7d7eb8" />
            </linearGradient>
            <marker
              id="flow-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="3.5"
              markerHeight="3.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="rgba(160, 180, 210, 0.6)" />
            </marker>
          </defs>
          <g
            fill="none"
            strokeWidth={1.8}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.55}
          >
            <path
              d="M 66,72 Q 78,72 78,64"
              stroke="url(#flow-ground-sky)"
              markerStart="url(#flow-arrow)"
              markerEnd="url(#flow-arrow)"
            />
            <path
              d="M 68,16 Q 50,2 32,16"
              stroke="url(#flow-sky-space)"
              markerStart="url(#flow-arrow)"
              markerEnd="url(#flow-arrow)"
            />
          </g>
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
      />
      <EndGameOverlay
        state={state}
        onPlayAgain={() => dispatch({ type: 'new-game' })}
      />
    </main>
  );
}
