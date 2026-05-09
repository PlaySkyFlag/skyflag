// Opening book — hard-coded "first few moves" for the AI so it doesn't
// burn search time on positions where strong play is already known.
//
// Why a book at all: the first few moves of every SkyFlag game are
// essentially the same situation — empty board, full hand. Searching
// to depth 4 for "deploy soldier or captain first?" produces the
// same answer every time, costing real CPU. A book hands back the
// answer instantly.
//
// What's in it: SkyFlag opening principles distilled to two rules:
//   1. Deploy a key attacker first (Soldier or Captain — the pieces
//      that can win games via flag-capture or promotion).
//   2. Deploy the OTHER key attacker second so both win paths are
//      committed to the board before transports arrive.
// Transports (Rover, Pilot) come off the bench third+ but at that
// point the search is fast enough and benefits more from real
// position-aware decisions than a hard-coded continuation.
//
// Variety: each rule offers 2 choices weighted by SkyFlag tradition
// (Soldier slightly preferred first since it's cheaper to lose if the
// opening goes wrong). Random pick keeps games feeling distinct
// without weakening play.

import type { Action } from './reducer';
import type { GameState, PieceKind, Player } from './types';

// Returns a book action for the current player at this state, or null
// to fall through to the regular search. Called from chooseAction
// before any search work begins.
export function bookActionFor(state: GameState): Action | null {
  if (state.status.kind !== 'in-progress') return null;

  const player = state.currentPlayer;
  const myOnBoard = state.onBoard.filter((bp) => bp.piece.owner === player);
  const myHand = state.inHand[player];

  // ── Move 1: empty board, full hand ──────────────────────────────────
  // Both players' first activation. Deploy a key attacker.
  if (myOnBoard.length === 0) {
    return deployFirstAttacker(myHand, player);
  }

  // ── Move 2: one piece on board, three in hand ───────────────────────
  // If the first deploy was a key attacker, follow up with the other
  // attacker. If it was a transport (player went off-book), bail and
  // let search take over.
  if (myOnBoard.length === 1 && myHand.length === 3) {
    const firstKind = myOnBoard[0].piece.kind;
    if (firstKind === 'soldier' || firstKind === 'captain') {
      const want: PieceKind = firstKind === 'soldier' ? 'captain' : 'soldier';
      const piece = myHand.find((p) => p.kind === want);
      if (piece) return { type: 'deploy', pieceId: piece.id };
    }
  }

  // Past move 2: fall through to search. Position-specific judgment
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
