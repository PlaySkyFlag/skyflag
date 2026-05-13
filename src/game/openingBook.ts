// Opening book — hard-coded "first few moves" for the AI so it doesn't
// burn search time on positions where strong play is already known.
//
// Why a book at all: the first few moves of every Skyflag game are
// essentially the same situation — empty board, full hand. Searching
// to depth 4 for "deploy soldier or captain first?" produces the
// same answer every time, costing real CPU. A book hands back the
// answer instantly.
//
// What's in it: Skyflag opening principles distilled to two rules:
//   1. Deploy a key attacker first (Soldier or Captain — the pieces
//      that can win games via flag-capture or promotion).
//   2. Deploy the OTHER key attacker second so both win paths are
//      committed to the board before transports arrive.
// Transports (Rover, Pilot) come off the bench third+ but at that
// point the search is fast enough and benefits more from real
// position-aware decisions than a hard-coded continuation.
//
// Variety: each rule offers 2 choices weighted by Skyflag tradition
// (Soldier slightly preferred first since it's cheaper to lose if the
// opening goes wrong). Random pick keeps games feeling distinct
// without weakening play.

import { DEPLOY_COORDS } from './constants';
import type { Action } from './reducer';
import type { GameState, PieceKind, Player } from './types';

// Returns a book action for the current player at this state, or null
// to fall through to the regular search. Called from chooseAction
// before any search work begins.
//
// Note: the book guarantees its suggestions are LEGAL — callers can
// dispatch them directly. The most subtle constraint is that
// deploy-the-second-piece can only fire when the deploy coord is free,
// i.e. the first piece has already moved off it.
export function bookActionFor(state: GameState): Action | null {
  if (state.status.kind !== 'in-progress') return null;

  const player = state.currentPlayer;
  const myOnBoard = state.onBoard.filter((bp) => bp.piece.owner === player);
  const myHand = state.inHand[player];

  // ── Move 1: empty board, full hand ──────────────────────────────────
  // Both players' first activation. Deploy a key attacker. Deploy
  // coord is guaranteed free since nothing's on the board yet.
  if (myOnBoard.length === 0) {
    return deployFirstAttacker(myHand, player);
  }

  // ── Move 2 (next-turn variant): one piece on board, deploy slot free
  // ─────────────────────────────────────────────────────────────────
  // Fires when the first-deployed piece has moved off the deploy
  // square (typically on the next turn). Completes the soldier+captain
  // pair — both attack-pieces committed before transports come out.
  // The deploy-coord check is critical: skipping it would suggest an
  // illegal "deploy on top of the existing piece" action.
  if (myOnBoard.length === 1 && myHand.length === 3) {
    const deployCoord = DEPLOY_COORDS[player];
    const slotOccupied = state.onBoard.some(
      (bp) =>
        bp.coord.layer === deployCoord.layer &&
        bp.coord.row === deployCoord.row &&
        bp.coord.col === deployCoord.col,
    );
    if (slotOccupied) return null;

    const firstKind = myOnBoard[0].piece.kind;
    if (firstKind === 'soldier' || firstKind === 'captain') {
      const want: PieceKind = firstKind === 'soldier' ? 'captain' : 'soldier';
      const piece = myHand.find((p) => p.kind === want);
      if (piece) return { type: 'deploy', pieceId: piece.id };
    }
  }

  // ── Move 3: two attackers on board, both transports in hand, deploy
  // slot free ──────────────────────────────────────────────────────
  // Completes the four-piece commitment: Soldier + Captain are
  // already on the board, now bring out a Transport. Rover slightly
  // favoured (55%) over Pilot because orthogonal movement aligns
  // better with the column-aligned deploy launch; the 45% Pilot
  // branch keeps openings from being fully predictable.
  if (myOnBoard.length === 2 && myHand.length === 2) {
    const deployCoord = DEPLOY_COORDS[player];
    const slotOccupied = state.onBoard.some(
      (bp) =>
        bp.coord.layer === deployCoord.layer &&
        bp.coord.row === deployCoord.row &&
        bp.coord.col === deployCoord.col,
    );
    if (slotOccupied) return null;

    // Only fire if the two on-board pieces are the attackers — if
    // the user deployed a transport first (off-book), the book has
    // no canned answer for what to do next.
    const onBoardKinds = new Set(myOnBoard.map((bp) => bp.piece.kind));
    if (!onBoardKinds.has('soldier') || !onBoardKinds.has('captain')) {
      return null;
    }

    const rover = myHand.find((p) => p.kind === 'rover');
    const pilot = myHand.find((p) => p.kind === 'pilot');
    if (rover && pilot) {
      const pick = Math.random() < 0.55 ? rover : pilot;
      return { type: 'deploy', pieceId: pick.id };
    }
    if (rover) return { type: 'deploy', pieceId: rover.id };
    if (pilot) return { type: 'deploy', pieceId: pilot.id };
  }

  // Past move 3: fall through to search. Position-specific judgment
  // matters too much to hardcode further.
  return null;
}

// Helper — pick which key attacker to deploy first. Soldier is favored
// (60%) because losing a Soldier early hurts less than losing the
// Captain, and a promoted Soldier eventually fills in as a second
// Captain anyway. The 40% Captain branch keeps openings from being
// fully predictable when the AI faces a human who studies its play.
function deployFirstAttacker(hand: GameState['inHand'][Player], _player: Player): Action | null {
  const soldier = hand.find((p) => p.kind === 'soldier');
  const captain = hand.find((p) => p.kind === 'captain');

  // If both are available, weighted random pick.
  if (soldier && captain) {
    const pick = Math.random() < 0.6 ? soldier : captain;
    return { type: 'deploy', pieceId: pick.id };
  }

  // Only one available — deploy whatever's there.
  if (soldier) return { type: 'deploy', pieceId: soldier.id };
  if (captain) return { type: 'deploy', pieceId: captain.id };

  // Neither — book has nothing to say, let search decide.
  return null;
}
