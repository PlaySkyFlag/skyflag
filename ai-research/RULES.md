# Skyflag — authoritative rules digest

Framework-neutral specification of the game **as the shipped engine actually
plays it**, extracted from the code (not the rulebook). Every rule cites its
source so a Ludii / Ai Ai spec — or a human reading the rulebook — can be
checked against ground truth. Where the code and the prose rulebook
(`scripts/rulebook-v20.html`) might disagree, the code wins here, and the
disagreement is flagged as an **open reconciliation item**.

Source files: `src/game/constants.ts`, `src/game/moves.ts`,
`src/game/reducer.ts`, `src/game/types.ts`. Rule version: post-v20, after the
June-9 "pieces enter on the Meridian (sky); Soldiers promote on any layer"
change (`fb80f53`).

---

## 1. Board

- **Three stacked layers**, top-to-bottom display order `space → sky → ground`
  (`constants.ts` `LAYER_ORDER`). "Sky" is the **Meridian** (middle layer).
- Each layer is a **6×6 grid**, rows `0–5`, cols `0–5` (`BOARD_SIZE = 6`).
  108 cells total.
- **Lift cells** at `(1,1) (1,4) (4,1) (4,4)`, identical on every layer
  (`LIFT_CELLS`). They are the only vertical connectors between layers.
- **Nexus** at `space (3,3)` (`NEXUS_COORD`) — the Captain win square.
- **Flags** — fixed per player per layer (`FLAG_COORDS`):
  | | ground | sky | space |
  |---|---|---|---|
  | P1 | (0,0) | (0,5) | (0,0) |
  | P2 | (5,5) | (5,0) | (5,5) |
  A flag is a static objective marker on its square; it is "captured"
  (removed) by an enemy Captain landing on it.

## 2. Pieces

Each player owns exactly **four** pieces, all starting **in hand**
(`buildPiecesFor`): one each of **Captain, Soldier, Rover, Pilot**.

Movement is **within a single layer** unless using a lift step (§4).
`inBounds` clips to the 6×6 grid. A piece never lands on a friendly piece.

| Piece | Movement | Capture | Notes |
|---|---|---|---|
| **Captain** | King: 1 step, 8 directions (`KING_DELTAS`) | by landing on the destination | captures flags (§5); wins via Nexus (§6) |
| **Soldier** | 1 step straight forward to an **empty** square; **2** steps on its first move if both squares empty | **diagonal-forward only**, onto an enemy piece | forward dir P1 = +row, P2 = −row (`FORWARD_ROW_DELTA`); promotes (§3) |
| **Rover** | Orthogonal, up to **2** squares, **no jumping** | by landing, at range **1 or 2** | true limited rook (revised from v19.1's capture-at-1-only) |
| **Pilot** | Diagonal, up to **2** squares, **no jumping** | by landing, at range **1 or 2** | limited bishop |

"No jumping": the 2-square move is legal only if the intermediate square is
empty (`moves.ts` Rover/Pilot blocks). A friendly piece on square 1 blocks
both the 1- and 2-step.

> **Reconciliation flag (capture model):** `capturesFor` in `reducer.ts` only
> ever captures the **destination** piece. The comment in the move-apply path
> mentions a "Pilot 2-sq jump captures the intermediate piece" rule, but the
> implemented Pilot move (§Pilot above) **cannot** jump — it requires the
> intermediate empty — so no intermediate capture can occur. The
> `capturesFor` list is shaped for future multi-capture but today is
> single-capture-by-landing for **all** pieces. A Ludii spec should model
> single capture-by-landing and ignore the stale comment.

## 3. Promotion

- A **Soldier** reaching its **far row** (P1 → row 5, P2 → row 0;
  `isPromotionRow`) promotes to a **Captain** (`nextPieceState`).
- Promotion happens on the **far row of ANY layer**, not just ground
  (this is the June-9 change — the rulebook may still say "Ground row").
- Promotion is applied **before** flag capture in the same activation
  (`reducer.ts`), so a Soldier can promote by reaching the far row and, if
  that square is the enemy flag square, capture the flag in the same step.
- A promoted Captain carries `promotedFromSoldier: true` but is otherwise an
  ordinary Captain (full king move, can win the Nexus).

## 4. Lift step (vertical move)

- **Any** piece standing on a **lift cell** may, as its move, step to the
  **same (row,col) on an adjacent layer** (`legalLiftSteps`):
  `ground ↔ sky ↔ space`.
- The destination cell **must be empty** — a lift step **cannot capture**.
- A lift step is one activation. Same-turn "move onto a lift, then lift" is
  allowed (revised from the v19.1 "two separate turns" rule). Because each
  click/activation is atomic, no per-piece transient state is needed
  (`types.ts` BoardPiece note).
- Legal destinations returned by `legalMovesFor` = same-layer movement
  **concatenated with** lift steps, so the AI sees them as ordinary moves.

## 5. Flag capture

- Only a **Captain** (original or promoted) captures flags
  (`maybeCaptureFlag`).
- Trigger: the Captain lands on the **opponent's** flag coordinate **for the
  layer it is on**. The flag is marked captured (and removed); re-landing does
  nothing.
- Flags are captured independently per layer; capturing all three of an
  opponent's flags is the precondition for the Nexus win (§6).

## 6. Turn structure & win/draw conditions

**Turn** = **2 activations** (`ACTIVATIONS_PER_TURN`). Each activation is one
of: **deploy** a hand piece, or **move** an on-board piece (incl. lift step).
After 2 activations (or a manual end-turn) initiative passes (`passInitiative`).

- **Deploy** (`applyDeploy`): place a hand piece onto your **own deploy cell**
  on the **sky/Meridian** — P1 `sky (0,3)`, P2 `sky (5,2)` (`DEPLOY_COORDS`).
  Legal only if that cell is **empty**. (So you cannot deploy again until the
  piece sitting on the pad has moved off it — this is the cause of the
  forced-pass positions; see §7.)

**Win conditions** (checked in this order after a move settles):

1. **Nexus win** (`isNexusWin`): a **Captain** lands on `space (3,3)` **and**
   all **three** of the opponent's flags are already captured. Reason `nexus`.
2. **Elimination** (`isEliminated`): a player has **no Captain and no Soldier**
   anywhere — neither in hand nor on board (Rovers/Pilots alone cannot win and
   cannot promote, so that player can never reach a Nexus win). Reason
   `elimination`. Checked both after a capture and at turn-pass for the side
   about to move.
3. **Time-out** (`applyTick`, optional clock): a side's clock hits 0 → opponent
   wins, reason `time-out`.
4. **Resignation** / **draw agreement**: explicit actions.

**Draws:**

- **Turn limit**: `TURN_LIMIT = 180` turns reached without a win →
  resolved by the rulebook §7 **tiebreakers** (`resolveTurnLimit`), in order:
  (1) opponent flags captured, (2) own pieces remaining, (3) opponent pieces
  captured, (4) highest layer occupied, (5) smallest Captain Chebyshev (row,col)
  distance to Space(3,3) — first strict difference wins. A **full tie** across
  all five → `draw / turn-limit`; otherwise `won / turn-limit` carried by the
  `winner` field. (Implemented 2026-06-14; previously a flat draw.)
- **Stalemate**: neither player has any legal action → `draw / stalemate`.

## 7. Forced pass (subtle, easy to get wrong)

The side to move can have **zero legal deploys and zero legal moves** while the
**opponent can still act** — e.g. the deploy pad is blocked by your own piece
and all your on-board pieces are pinned. This is **not** a stalemate (stalemate
requires *both* players unable to act). The engine has **no auto-pass** for
this case; the shipped app resolves it with the **end-turn** button, and
`legalActions()` deliberately does **not** include `end-turn`.

Consequences for any AI / formal spec:

- A faithful playout or MCTS must model a **forced pass** when the side to move
  has no move but the game is live. (Skyflag's `ai-research/analyze.ts`
  `actionsWithPass` does exactly this; without it, ~2.6% of random rollouts got
  stuck mid-game.)
- A Ludii spec must allow a **pass move** that is legal **only** when no other
  move exists, otherwise its legal-move tree will diverge from the perft oracle.

## 8. Perft oracle (cross-check anchor)

From the opening, counting one tree edge = one activation (forced pass
included), via `ai-research/analyze.ts perft`:

| depth (activations) | leaf nodes |
|---:|---:|
| 1 | 4 |
| 2 | 17 |
| 3 | 68 |
| 4 | 289 |
| 5 | 2 499 |

A Ludii/Ai Ai spec that models Skyflag faithfully **must reproduce these leaf
counts exactly**. Any divergence localises a rule bug to the shallowest depth
where the counts first differ.

## 9. Open reconciliation items

1. ~~Turn-limit tiebreakers unimplemented~~ — **DONE 2026-06-14**
   (`resolveTurnLimit`). A faithful GGP/Ludii spec must now model the five-step
   §7 tiebreak, not a flat draw.
2. **Stale Pilot "jump-capture" comment** in `reducer.ts` vs the no-jump Pilot
   move — confirm intent (current behaviour: no jump, no intermediate capture).
3. **Rulebook prose** may still say Soldiers promote on the **Ground** far row
   and that pieces **enter on the floor** — both superseded by the June-9 code.
   Update the rulebook to match, or vice-versa.
