import { DEPLOY_COORDS, FLAG_COORDS, NEXUS_COORD } from './constants';
import { legalMovesFor } from './moves';
import { pstScore } from './pst';
import { reduce, type Action } from './reducer';
import type {
  CaptainPiece,
  Coord,
  GameState,
  Layer,
  PieceKind,
  Player,
  SoldierPiece,
} from './types';
import { opponentOf } from './types';

// Default search depth in plies (one ply = one activation). 4 plies = two
// full turns of foresight (you + opponent), the qualitative level where the
// AI starts seeing trades and counter-attacks. The UI difficulty selector
// can override this — easy=2, medium=3, hard=4. Runs on the Web Worker so
// UI stays smooth even when search takes longer.
const DEFAULT_SEARCH_DEPTH = 4;

// ─── Transposition table ───────────────────────────────────────────────────
// Caches search results so the same position reached via different move
// orders doesn't get re-searched. Bound on size — Map iteration order is
// insertion order, so we evict the oldest entries when the cap is hit.
type TTEntry = {
  depth: number;
  score: number;
  // 'exact' = score is the true minimax value at this depth.
  // 'lower' = score is a lower bound (failed high — true value ≥ score).
  // 'upper' = score is an upper bound (failed low — true value ≤ score).
  flag: 'exact' | 'lower' | 'upper';
  // Best action found at this node, used for move ordering on revisit.
  bestAction?: Action;
};

const TT_MAX_SIZE = 60_000;
const transTable = new Map<string, TTEntry>();

function ttSet(key: string, entry: TTEntry): void {
  if (transTable.size >= TT_MAX_SIZE) {
    const oldestKey = transTable.keys().next().value;
    if (oldestKey !== undefined) transTable.delete(oldestKey);
  }
  transTable.set(key, entry);
}

// Compact string hash of every state attribute that influences future
// search. History/captured/status are not included — they don't change
// future play (status is checked separately). Pieces are sorted by id so
// equivalent states with different array orderings hash to the same key.
function hashState(s: GameState): string {
  const board = [...s.onBoard]
    .sort((a, b) => (a.piece.id < b.piece.id ? -1 : 1))
    .map((bp) => {
      const p = bp.piece;
      const kind = p.kind[0];
      const owner = p.owner === 'p1' ? '1' : '2';
      let meta = '';
      if (p.kind === 'captain' && (p as CaptainPiece).promotedFromSoldier) meta = 'P';
      else if (p.kind === 'soldier' && (p as SoldierPiece).hasMoved) meta = 'M';
      return `${p.id}@${bp.coord.layer[0]}${bp.coord.row}${bp.coord.col}${kind}${owner}${meta}`;
    })
    .join('|');
  const handP1 = [...s.inHand.p1].map((p) => p.id).sort().join(',');
  const handP2 = [...s.inHand.p2].map((p) => p.id).sort().join(',');
  const flags =
    (s.flags.ground.p1 ? '1' : '0') +
    (s.flags.ground.p2 ? '1' : '0') +
    (s.flags.sky.p1 ? '1' : '0') +
    (s.flags.sky.p2 ? '1' : '0') +
    (s.flags.space.p1 ? '1' : '0') +
    (s.flags.space.p2 ? '1' : '0');
  return `${s.currentPlayer}:${s.activationsRemaining}:${s.turnNumber}:${flags}|B${board}|h1${handP1}|h2${handP2}`;
}

// Quiescence search extends beyond SEARCH_DEPTH but only follows capture
// moves, so the AI can't be tricked by the "horizon effect" — walking into
// a capture because the regular search stopped one ply before the trap.
const QUIESCENCE_DEPTH = 4;

const WIN_SCORE = 1_000_000;
const LAYER_INDEX: Record<Layer, number> = { ground: 0, sky: 1, space: 2 };

function pieceValue(kind: PieceKind): number {
  switch (kind) {
    // Captain bumped 100 → 350 — losing your last Captain ends the game,
    // so the AI should treat Captain material as fundamentally different
    // from minor pieces. The previous 100 was too close to a Soldier
    // and let the search trade Captain-for-Soldier swaps as if they
    // were near-equal exchanges.
    case 'captain': return 350;
    case 'soldier': return 60;
    case 'rover':   return 30;
    case 'pilot':   return 30;
  }
}

function isOccupied(state: GameState, c: Coord): boolean {
  return state.onBoard.some(
    (bp) => bp.coord.layer === c.layer && bp.coord.row === c.row && bp.coord.col === c.col,
  );
}

// Every legal Action the current player could take. End-turn excluded —
// reducers/AI fall back to that when nothing else is available.
export function legalActions(state: GameState): Action[] {
  if (state.status.kind !== 'in-progress') return [];
  if (state.activationsRemaining <= 0) return [];

  const actions: Action[] = [];
  const player = state.currentPlayer;

  const deployCoord = DEPLOY_COORDS[player];
  if (!isOccupied(state, deployCoord)) {
    for (const piece of state.inHand[player]) {
      actions.push({ type: 'deploy', pieceId: piece.id });
    }
  }

  for (const bp of state.onBoard) {
    if (bp.piece.owner !== player) continue;
    for (const target of legalMovesFor(bp, state)) {
      actions.push({ type: 'move', pieceId: bp.piece.id, to: target });
    }
  }

  return actions;
}

// Distance metric tuned for SkyFlag: Chebyshev within a layer (Captain king-
// move) + heavy layer-change cost (lifts take two activations).
function strategicDist(a: Coord, b: Coord): number {
  const layerCost = Math.abs(LAYER_INDEX[a.layer] - LAYER_INDEX[b.layer]) * 4;
  return layerCost + Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

// Player p's next strategic target: the next un-captured opponent flag
// (Ground → Sky → Space order), or the Nexus once all 3 are gone.
function targetFor(state: GameState, p: Player): Coord {
  const opp = opponentOf(p);
  const layers: Layer[] = ['ground', 'sky', 'space'];
  for (const layer of layers) {
    if (!state.flags[layer][opp]) {
      const f = FLAG_COORDS[opp][layer];
      return { layer, row: f.row, col: f.col };
    }
  }
  return NEXUS_COORD;
}

// Closest distance from any of player p's win-capable on-board pieces
// (Captains + Soldiers) to their strategic target. Returns Infinity if none.
function closestDistToTarget(state: GameState, p: Player): number {
  const target = targetFor(state, p);
  let best = Infinity;
  for (const bp of state.onBoard) {
    if (bp.piece.owner !== p) continue;
    if (bp.piece.kind !== 'captain' && bp.piece.kind !== 'soldier') continue;
    const d = strategicDist(bp.coord, target);
    if (d < best) best = d;
  }
  return best;
}

// Computes both the "attack set" (squares the player could move a piece
// onto, i.e. capture targets) and the raw mobility count in one pass.
// Used together inside evaluate() so we don't iterate pieces twice.
function attackInfo(
  state: GameState,
  player: Player,
): { squares: Set<string>; mobility: number } {
  const squares = new Set<string>();
  let mobility = 0;
  for (const bp of state.onBoard) {
    if (bp.piece.owner !== player) continue;
    const moves = legalMovesFor(bp, state);
    mobility += moves.length;
    for (const t of moves) squares.add(`${t.layer}:${t.row}:${t.col}`);
  }
  return { squares, mobility };
}

// Static evaluation of `state` from `aiPlayer`'s perspective. Higher = better
// for aiPlayer. Deterministic — minimax requires same input → same output.
export function evaluate(state: GameState, aiPlayer: Player): number {
  if (state.status.kind === 'won') {
    return state.status.winner === aiPlayer ? WIN_SCORE : -WIN_SCORE;
  }
  if (state.status.kind === 'draw') return 0;

  const opp = opponentOf(aiPlayer);
  let score = 0;

  // Material + positional — board pieces score for material AND for where
  // they're standing. The PST lookup encodes "where pieces want to be"
  // (center control, lift proximity, advanced rows for soldiers, Nexus
  // for captains on Space) that isn't already captured by distance-to-
  // target or mobility. In-hand pieces are discounted material only.
  for (const bp of state.onBoard) {
    const sign = bp.piece.owner === aiPlayer ? 1 : -1;
    score += pieceValue(bp.piece.kind) * sign;
    score += pstScore(bp.piece, bp.coord) * sign;
  }
  for (const piece of state.inHand[aiPlayer]) score += pieceValue(piece.kind) * 0.7;
  for (const piece of state.inHand[opp])      score -= pieceValue(piece.kind) * 0.7;

  // Flag progress — opponent flags I've captured are good; mine they took, bad.
  for (const layer of ['ground', 'sky', 'space'] as const) {
    if (state.flags[layer][opp])      score += 500;
    if (state.flags[layer][aiPlayer]) score -= 500;
  }

  // Strategic positioning — closer is better for me, opponent farther is also
  // better for me. Each square of distance worth ~3 score points.
  const myDist  = closestDistToTarget(state, aiPlayer);
  const oppDist = closestDistToTarget(state, opp);
  if (myDist  !== Infinity) score -= myDist * 3;
  if (oppDist !== Infinity) score += oppDist * 3;

  // Threats and mobility — computed in one sweep per side.
  const myInfo  = attackInfo(state, aiPlayer);
  const oppInfo = attackInfo(state, opp);

  // Mobility: each legal move is worth ~1 point. More options = better
  // position. Helps the AI prefer flexible setups over cornered ones.
  score += myInfo.mobility  * 1.2;
  score -= oppInfo.mobility * 1.2;

  // Threat detection — for every piece, check whether the opponent can
  // capture it next ply. Threatened pieces lose 40% of their value as a
  // pressure penalty (was 25% — bumped because mid-game observation
  // showed the AI was happy to leave pieces hanging). Captain threats
  // get an additional fixed penalty since losing your last Captain ends
  // the game outright. We also count the AI's own Captains and apply
  // an extra "exposed Captain" multiplier when the threat is from a
  // capable attacker, so the AI strongly prefers to retreat or defend.
  let myCaptainsThreatened = 0;
  let oppCaptainsThreatened = 0;
  for (const bp of state.onBoard) {
    const key = `${bp.coord.layer}:${bp.coord.row}:${bp.coord.col}`;
    const owner = bp.piece.owner;
    const value = pieceValue(bp.piece.kind);
    if (owner === aiPlayer && oppInfo.squares.has(key)) {
      score -= value * 0.40;
      if (bp.piece.kind === 'captain') {
        score -= 250;
        myCaptainsThreatened++;
      }
    } else if (owner === opp && myInfo.squares.has(key)) {
      score += value * 0.40;
      if (bp.piece.kind === 'captain') {
        score += 250;
        oppCaptainsThreatened++;
      }
    }
  }

  // Multi-Captain hazards: if the AI has any Captain threatened AND
  // can't defend or retreat both, the situation compounds. Apply an
  // extra fork-style penalty per threatened Captain past the first
  // (the first one already lost 250 above).
  if (myCaptainsThreatened > 1) score -= 200 * (myCaptainsThreatened - 1);
  if (oppCaptainsThreatened > 1) score += 200 * (oppCaptainsThreatened - 1);

  return score;
}

// Cheap heuristic for move ordering — captures and flag-captures get tried
// first, which makes alpha-beta cuts much more effective.
function orderingHeuristic(state: GameState, action: Action): number {
  if (action.type !== 'move') return 0;

  const target = state.onBoard.find(
    (bp) =>
      bp.coord.layer === action.to.layer &&
      bp.coord.row === action.to.row &&
      bp.coord.col === action.to.col &&
      bp.piece.owner !== state.currentPlayer,
  );
  if (target) return 200 + pieceValue(target.piece.kind);

  const piece = state.onBoard.find((bp) => bp.piece.id === action.pieceId)?.piece;
  if (piece?.kind === 'captain') {
    const opp = opponentOf(state.currentPlayer);
    const flag = FLAG_COORDS[opp][action.to.layer];
    if (
      action.to.row === flag.row &&
      action.to.col === flag.col &&
      !state.flags[action.to.layer][opp]
    ) {
      return 400;
    }
  }

  return 0;
}

function orderActions(state: GameState, actions: Action[]): Action[] {
  return actions
    .map((a) => ({ a, h: orderingHeuristic(state, a) }))
    .sort((x, y) => y.h - x.h)
    .map((s) => s.a);
}

// Same as `orderActions` but boosts the priority of `priority` to first
// position. Used when the transposition table tells us a move was best
// at a previous (shallower) search — trying it first usually produces
// the strongest alpha-beta cuts on this revisit.
function orderActionsWithPriority(
  state: GameState,
  actions: Action[],
  priority: Action | undefined,
): Action[] {
  const ordered = orderActions(state, actions);
  if (!priority) return ordered;
  const idx = ordered.findIndex((a) => actionsEqual(a, priority));
  if (idx <= 0) return ordered;
  const [picked] = ordered.splice(idx, 1);
  ordered.unshift(picked);
  return ordered;
}

function actionsEqual(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'deploy' && b.type === 'deploy') return a.pieceId === b.pieceId;
  if (a.type === 'move' && b.type === 'move')
    return (
      a.pieceId === b.pieceId &&
      a.to.layer === b.to.layer &&
      a.to.row === b.to.row &&
      a.to.col === b.to.col
    );
  return false;
}

// Detects whether `action` lands on an opponent piece — i.e. is a capture.
// Used by quiescence to follow only captures past the regular search depth.
function isCapture(state: GameState, action: Action): boolean {
  if (action.type !== 'move') return false;
  return state.onBoard.some(
    (bp) =>
      bp.coord.layer === action.to.layer &&
      bp.coord.row === action.to.row &&
      bp.coord.col === action.to.col &&
      bp.piece.owner !== state.currentPlayer,
  );
}

// Quiescence search: when minimax hits depth 0, instead of returning
// evaluate() blindly, keep going as long as captures are pending. The
// "stand pat" pattern lets a side decline to capture if doing so would
// worsen its position (the standing eval is treated as a lower bound for
// the maximiser, upper bound for the minimiser). Bounded by a small extra
// depth to prevent runaway recursion in capture-rich positions.
function quiescence(
  state: GameState,
  alpha: number,
  beta: number,
  aiPlayer: Player,
  depth: number,
): number {
  if (depth === 0 || state.status.kind !== 'in-progress') {
    return evaluate(state, aiPlayer);
  }

  const standPat = evaluate(state, aiPlayer);
  const isMax = state.currentPlayer === aiPlayer;

  if (isMax) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  const captures = legalActions(state).filter((a) => isCapture(state, a));
  if (captures.length === 0) return standPat;

  const ordered = orderActions(state, captures);

  if (isMax) {
    let value = standPat;
    for (const action of ordered) {
      const next = reduce(state, action);
      value = Math.max(value, quiescence(next, alpha, beta, aiPlayer, depth - 1));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = standPat;
  for (const action of ordered) {
    const next = reduce(state, action);
    value = Math.min(value, quiescence(next, alpha, beta, aiPlayer, depth - 1));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

// Minimax with alpha-beta. `aiPlayer` is fixed throughout the search (the side
// we're optimising for). Whether a node is a max- or min-node depends on
// whether state.currentPlayer matches `aiPlayer`.
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  aiPlayer: Player,
): number {
  if (state.status.kind !== 'in-progress') {
    return evaluate(state, aiPlayer);
  }
  if (depth === 0) {
    return quiescence(state, alpha, beta, aiPlayer, QUIESCENCE_DEPTH);
  }

  // Save originals — needed below to know whether the final score is an
  // exact value or a bound, which determines the TT entry flag.
  const alphaOrig = alpha;
  const betaOrig = beta;

  // Transposition-table probe: if we already searched this exact position
  // to at least the depth we need, reuse the cached result (or tighten
  // alpha/beta from the cached bound).
  const ttKey = hashState(state);
  const ttHit = transTable.get(ttKey);
  if (ttHit && ttHit.depth >= depth) {
    if (ttHit.flag === 'exact') return ttHit.score;
    if (ttHit.flag === 'lower' && ttHit.score >= beta) return ttHit.score;
    if (ttHit.flag === 'upper' && ttHit.score <= alpha) return ttHit.score;
  }

  const actions = legalActions(state);
  if (actions.length === 0) {
    // No legal action — the player must end-turn. Recurse on the resulting
    // state (turn passes to opponent).
    const next = reduce(state, { type: 'end-turn' });
    return minimax(next, depth - 1, alpha, beta, aiPlayer);
  }

  const ordered = orderActionsWithPriority(state, actions, ttHit?.bestAction);
  const isMax = state.currentPlayer === aiPlayer;

  let value = isMax ? -Infinity : Infinity;
  let bestAction: Action | undefined;

  for (const action of ordered) {
    const next = reduce(state, action);
    const childValue = minimax(next, depth - 1, alpha, beta, aiPlayer);
    if (isMax) {
      if (childValue > value) {
        value = childValue;
        bestAction = action;
      }
      alpha = Math.max(alpha, value);
    } else {
      if (childValue < value) {
        value = childValue;
        bestAction = action;
      }
      beta = Math.min(beta, value);
    }
    if (alpha >= beta) break;
  }

  // Determine the TT entry flag from how the score relates to the original
  // window. Exact means we explored the full window without cutoff;
  // lower/upper means we hit a beta/alpha cutoff and the score is a bound.
  let flag: TTEntry['flag'] = 'exact';
  if (value <= alphaOrig) flag = 'upper';
  else if (value >= betaOrig) flag = 'lower';

  ttSet(ttKey, { depth, score: value, flag, bestAction });

  return value;
}

export function chooseAction(state: GameState, searchDepth: number = DEFAULT_SEARCH_DEPTH): Action | null {
  // History isn't read by the search and the reducer clones the array on
  // every action. Stripping it on entry removes that growing per-clone
  // cost, which is the main reason the AI was getting laggy mid-game now
  // that the move history feature ships entries with every action.
  if (state.history.length > 0) {
    state = { ...state, history: [] };
  }

  const actions = legalActions(state);
  if (actions.length === 0) return null;

  const aiPlayer = state.currentPlayer;

  // Iterative deepening: search depth 1, 2, ..., SEARCH_DEPTH. At each
  // iteration the best action found so far is moved to the front of the
  // ordering for the next iteration, which gives alpha-beta much better
  // cuts (the strongest move tried first → pruning happens immediately
  // instead of after most of the tree has been explored). The cost of
  // the shallow searches is negligible compared to the savings.
  // Transposition table carries cached scores between iterations.
  let lastBestAction: Action | undefined;
  let scored: Array<{ action: Action; value: number }> = [];

  for (let depth = 1; depth <= searchDepth; depth++) {
    const ordered = orderActionsWithPriority(state, actions, lastBestAction);
    let bestValue = -Infinity;
    let alpha = -Infinity;
    const iterScored: Array<{ action: Action; value: number }> = [];

    for (const action of ordered) {
      const next = reduce(state, action);
      const value = minimax(next, depth - 1, alpha, Infinity, aiPlayer);
      iterScored.push({ action, value });
      if (value > bestValue) {
        bestValue = value;
        lastBestAction = action;
      }
      alpha = Math.max(alpha, value);
    }

    scored = iterScored;
  }

  if (scored.length === 0) return null;

  // Random tiebreak among top-scoring actions.
  const bestValue = Math.max(...scored.map((s) => s.value));
  const top = scored.filter((s) => s.value === bestValue);
  return top[Math.floor(Math.random() * top.length)].action;
}
