import { DEPLOY_COORDS, FLAG_COORDS, NEXUS_COORD } from './constants';
import { legalMovesFor } from './moves';
import { bookActionFor } from './openingBook';
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

// ─── Killer-move + history heuristic state ─────────────────────────────────
// Both are forms of "remember which moves have been useful" that improve
// move ordering and therefore alpha-beta cuts. Captures already get high
// priority via the static heuristic; killer/history slots are reserved
// for QUIET moves (non-captures) that surprised us by causing a cutoff.
//
// Killer moves: per-ply, two slots. When a quiet move at ply N caused a
// beta cutoff, store it. On the next visit to ply N (different branch
// of the tree), try those moves before generic quiet moves — the same
// move often refutes sibling positions with similar tactical themes.
//
// History heuristic: a per-(piece, destination) counter that accumulates
// across the whole search. Moves that have caused cutoffs anywhere build
// up a history score, used as a tiebreaker for quiet moves. Weighted by
// depth² so deeper cutoffs (which prove more about a move's strength)
// count more than shallow ones.
//
// Both are reset at the start of each chooseAction() call — accumulating
// across iterative-deepening iterations is the whole point, but bleeding
// state between AI turns would mis-prioritize moves for a stale position.

type KillerSlot = [Action | undefined, Action | undefined];
const killers: KillerSlot[] = [];
const historyTable = new Map<string, number>();
// Cap history scores so they can't grow unbounded and outrank killers
// or flag-capture priorities. ~300 leaves quiet moves comfortably below
// the 400/500 killer scores and the 900-1300 capture scores.
const HISTORY_CAP = 300;

function historyKey(action: Action): string {
  if (action.type === 'move') {
    return `m:${action.pieceId}:${action.to.layer}:${action.to.row}:${action.to.col}`;
  }
  if (action.type === 'deploy') {
    return `d:${action.pieceId}`;
  }
  // Never reached at runtime — historyKey is only called from
  // recordCutoff, which only runs on actions from legalActions
  // (move/deploy only). Fallback keeps TypeScript happy without an
  // unsafe cast.
  return `o:${action.type}`;
}

function recordCutoff(action: Action, ply: number, depth: number, state: GameState): void {
  // Captures already top the move ordering via the capture-victim heuristic.
  // Recording them as killers would just push out actually-useful quiet
  // killers, so skip.
  if (isCapture(state, action)) return;

  const slot = killers[ply] ?? (killers[ply] = [undefined, undefined]);
  // Don't double-store the same move in both slots.
  if (!slot[0] || !actionsEqual(slot[0], action)) {
    slot[1] = slot[0];
    slot[0] = action;
  }

  const key = historyKey(action);
  const cur = historyTable.get(key) ?? 0;
  historyTable.set(key, Math.min(cur + depth * depth, HISTORY_CAP));
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
    // Aggressive-capture tuning pass: previous values let flag-rush
    // dominate piece-trading decisions. The new scale puts piece
    // material clearly above flag bonuses, especially for the
    // Captain — capturing a Captain (700) is now worth more than
    // sweeping all three opponent flags combined (3 × 200 = 600).
    // Soldiers also bumped because they're the recruiting pool for
    // promoted Captains, so trading them away has real strategic
    // cost. Rovers and Pilots are minor utility but each adds a
    // useful threat vector — 60 keeps them above noise.
    case 'captain': return 700;
    case 'soldier': return 120;
    case 'rover':   return 60;
    case 'pilot':   return 60;
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

// Distance metric tuned for Skyflag: Chebyshev within a layer (Captain king-
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

  // Flag progress — opponent flags I've captured are good; mine they
  // took, bad. Per-flag bonus dropped 500 → 200 so flag-grabbing
  // doesn't dominate piece-capture decisions in the search; the win
  // condition itself is still handled by WIN_SCORE at terminal nodes.
  let myFlagsCaptured = 0;
  let oppFlagsCaptured = 0;
  for (const layer of ['ground', 'sky', 'space'] as const) {
    if (state.flags[layer][opp])      { score += 200; myFlagsCaptured++; }
    if (state.flags[layer][aiPlayer]) { score -= 200; oppFlagsCaptured++; }
  }

  // Final-flag rush — once a side has 2 of 3 flags, the third is
  // decisive. Add a meaningful bonus for whichever side is one flag
  // away so the AI doesn't dawdle on side-quests when it's about to
  // win, and defends harder when the opponent is about to win.
  if (myFlagsCaptured === 2)  score += 300;
  if (oppFlagsCaptured === 2) score -= 300;

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
        // Bumped 250 → 400 to match the higher Captain material value.
        // A threatened Captain is the single most urgent thing on the
        // board; the AI should retreat or interpose hard.
        score -= 400;
        myCaptainsThreatened++;
      }
    } else if (owner === opp && myInfo.squares.has(key)) {
      score += value * 0.40;
      if (bp.piece.kind === 'captain') {
        // Symmetric — opponent's threatened Captain is the most
        // valuable target the AI can chase.
        score += 400;
        oppCaptainsThreatened++;
      }
    }
  }

  // Multi-Captain hazards: if the AI has any Captain threatened AND
  // can't defend or retreat both, the situation compounds. Apply an
  // extra fork-style penalty per threatened Captain past the first
  // (the first one already lost 400 above). Bumped 200 → 300 to match
  // the higher Captain weight.
  if (myCaptainsThreatened > 1) score -= 300 * (myCaptainsThreatened - 1);
  if (oppCaptainsThreatened > 1) score += 300 * (oppCaptainsThreatened - 1);

  return score;
}

// Move-ordering heuristic. Score hierarchy (higher = tried first):
//   1000 + victim value  → capture  (1030 to 1350 across piece kinds)
//   900                   → captain landing on opponent's uncaptured flag
//   500 / 400             → killer-move slots 0 and 1 (quiet moves that
//                           caused cutoffs at this ply earlier in search)
//    0..300                → quiet moves, sorted by history-heuristic count
// Captures and flag-captures stay top-priority regardless of killer/history
// — those are tactical, the heuristics only refine quiet-move ordering.
function orderingHeuristic(state: GameState, action: Action, ply: number): number {
  if (action.type === 'move') {
    const target = state.onBoard.find(
      (bp) =>
        bp.coord.layer === action.to.layer &&
        bp.coord.row === action.to.row &&
        bp.coord.col === action.to.col &&
        bp.piece.owner !== state.currentPlayer,
    );
    if (target) return 1000 + pieceValue(target.piece.kind);

    const piece = state.onBoard.find((bp) => bp.piece.id === action.pieceId)?.piece;
    if (piece?.kind === 'captain') {
      const opp = opponentOf(state.currentPlayer);
      const flag = FLAG_COORDS[opp][action.to.layer];
      if (
        action.to.row === flag.row &&
        action.to.col === flag.col &&
        !state.flags[action.to.layer][opp]
      ) {
        return 900;
      }
    }
  }

  // Killer slots — quiet moves that recently caused beta cutoffs at this ply.
  const slot = killers[ply];
  if (slot) {
    if (slot[0] && actionsEqual(slot[0], action)) return 500;
    if (slot[1] && actionsEqual(slot[1], action)) return 400;
  }

  // History tiebreaker for everything else.
  return historyTable.get(historyKey(action)) ?? 0;
}

function orderActions(state: GameState, actions: Action[], ply: number): Action[] {
  return actions
    .map((a) => ({ a, h: orderingHeuristic(state, a, ply) }))
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
  ply: number,
): Action[] {
  const ordered = orderActions(state, actions, ply);
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

  // Quiescence orders by capture-victim value only — killer/history slots
  // don't apply here (qsearch only follows captures, never quiet moves).
  // Pass ply=0 as a no-op since killer/history won't match captures anyway.
  const ordered = orderActions(state, captures, 0);

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
// whether state.currentPlayer matches `aiPlayer`. `ply` counts half-moves
// from the root — used by the killer-move heuristic to index per-ply slots.
function minimax(
  state: GameState,
  depth: number,
  ply: number,
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
    return minimax(next, depth - 1, ply + 1, alpha, beta, aiPlayer);
  }

  const ordered = orderActionsWithPriority(state, actions, ttHit?.bestAction, ply);
  const isMax = state.currentPlayer === aiPlayer;

  let value = isMax ? -Infinity : Infinity;
  let bestAction: Action | undefined;

  for (const action of ordered) {
    const next = reduce(state, action);
    const childValue = minimax(next, depth - 1, ply + 1, alpha, beta, aiPlayer);
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
    if (alpha >= beta) {
      // Beta cutoff — record this move as a killer + bump its history score
      // so future visits to similar positions try it earlier in the ordering.
      recordCutoff(action, ply, depth, state);
      break;
    }
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
  // Opening book: hand back a known-strong move for the first 1–2 deploys
  // without burning search time on positions whose answer is the same
  // every game. Falls through to search past move 2, where position-
  // specific judgment matters too much to hardcode.
  //
  // Defensive legality check — even though the book is supposed to
  // only return legal actions, a bad book entry could otherwise wedge
  // the AI by returning an illegal deploy/move that the reducer rejects
  // (no-op state, AI loop spins). If the book's suggestion isn't in
  // legalActions, fall through to search instead of trusting it.
  const book = bookActionFor(state);
  if (book) {
    const legal = legalActions(state);
    if (legal.some((a) => actionsEqual(a, book))) {
      return book;
    }
  }

  // History isn't read by the search and the reducer clones the array on
  // every action. Stripping it on entry removes that growing per-clone
  // cost, which is the main reason the AI was getting laggy mid-game now
  // that the move history feature ships entries with every action.
  if (state.history.length > 0) {
    state = { ...state, history: [] };
  }

  // Reset the move-ordering heuristic state at the top of each search.
  // Killers and history accumulate across iterative-deepening iterations
  // (the whole point — depth-1 cutoffs guide depth-2 ordering, and so on).
  // But the position changes between AI turns, so carrying these across
  // chooseAction calls would mis-prioritize moves for a stale board.
  killers.length = 0;
  historyTable.clear();

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
    const ordered = orderActionsWithPriority(state, actions, lastBestAction, 0);
    let bestValue = -Infinity;
    let alpha = -Infinity;
    const iterScored: Array<{ action: Action; value: number }> = [];

    for (const action of ordered) {
      const next = reduce(state, action);
      // Root actions are at ply 0; the resulting state for minimax is ply 1.
      const value = minimax(next, depth - 1, 1, alpha, Infinity, aiPlayer);
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
