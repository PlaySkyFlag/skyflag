# Skyflag AI-research track

Purpose: stop *trusting* the hand-written engine's rules and *verify* them
against an independent, purpose-built game-AI system (Ludii / Ai Ai), and use
that system's strong MCTS as a balance oracle and sparring partner.

## Why a framework — and why NOT as the shipped engine

The frameworks (Ludii, Ai Ai, Zillions) are excellent as a **design oracle,
rule-faithfulness check, and reference opponent**. They are **not** a drop-in
runtime: they are JVM/Windows desktop apps and cannot be embedded in the Swift
iOS app or the TS web client. So the shipped engine stays `src/game/*`; the
framework is a verification + analysis + training-label track that runs
alongside it. Recommended: **Ludii** (formal spec + modern MCTS + headless
batch API + active development); **Ai Ai** as the balance-dashboard companion;
skip **Zillions** (dated alpha-beta AI, Windows-only, unmaintained).

## What's here

| File | What it is | Status |
|---|---|---|
| `RULES.md` | Authoritative, code-cited rules digest. The source of truth for any spec, and the place code-vs-rulebook drift is flagged. | ✅ done |
| `analyze.ts` | Runnable harness wrapping the **shipped** `legalActions`+`reduce`: `perft` (the cross-check oracle) and `balance` (random-rollout metrics). | ✅ done, runs today |
| `skyflag.lud` | Ludii ludeme **draft** — staged (single-layer first, 3D notes). Not yet compiled. | 🟡 draft, iterate against compiler |

## Run the harness (no Ludii needed)

```bash
npm run analyze perft   -- --depth 5
npm run analyze balance -- --games 3000 --seed 1
npm run analyze strong  -- --games 40 --depth 4 --seed 1      # strong self-play
# (or `npx tsx ai-research/analyze.ts <mode> …` directly)
```

- `perft` — leaf counts a Ludii spec must reproduce (the oracle).
- `balance` — random-play baseline: outcome/reason split, first-player share of
  decisive games, length, mean branching.
- `strong` — same metrics under the **shipped `chooseAction`** (NNUE-off
  alpha-beta), both sides identical config. `--time <ms>` adds a per-move time
  budget; `--depth` sets fixed depth (default 4). ~2s/game at d3, so keep games
  modest. Per-game seeded → reproducible.

### Random vs strong play (the contrast IS the signal)

| metric | random (3000g) | strong d3 (24g, seed 7) |
|---|---|---|
| P1 share of decisive games | ~52% | **50%** (no first-player bias) |
| turn-limit draws | ~21% | **~67%** (much drawier) |
| nexus wins | ~0% | **~13%** (the 3-flag campaign now happens) |
| elimination | ~78% | ~21% |
| median length (turns) | ~70 | **180** (most games hit the cap) |
| branching | ~12 | ~13 |

Perft oracle: **4 / 17 / 68 / 289 / 2499** at depth 1–5 (one edge = one activation).

**Design finding → fix shipped:** under competent play ~2/3 of strong games
reach the 180-turn limit. Those used to be flat draws; the rulebook §7
**tiebreakers are now implemented** (`reducer.ts resolveTurnLimit`,
2026-06-14), so the same 24-game strong run goes from **67% draws → 0%** — every
turn-limit game now decides on flags → pieces → captures → highest layer →
Captain distance to Nexus. (In that sample P2 won 10 of the 16 tiebreaks vs P1's
6 — consistent with the rulebook's noted Space(3,3) asymmetry; worth confirming
at d6 Expert and against Ludii MCTS with more games.)

## Finding already surfaced by this work

**Forced-pass positions are real and `legalActions()` doesn't model them.** A
side can have zero deploys + zero moves while the opponent can still act (not a
stalemate); the app resolves it with the end-turn button. ~2.6% of random
rollouts stalled on this until the harness added an explicit forced pass
(`actionsWithPass`). Any Ludii spec or MCTS must model the conditional pass or
its move tree will diverge from the perft oracle. (RULES.md §7.)

## The `.lud` is grounded in real Ludii games (not invented)

`skyflag.lud` is still **uncompiled** (no Java/Ludii in the dev box), but every
ludeme is now adapted from a shipped Ludii game file, cited inline, instead of
written from memory — the whole point of the exercise. Sources (from
`github.com/Ludeme/Ludii`, v1.3.x):

| mechanic | source file |
|---|---|
| hand drops, StepMove/SlideMove+capture, promotion, `("SameTurn")`+`(move Pass)` | `…/shogi/Shogi.lud` |
| Soldier = chess pawn (forward-empty, diagonal-capture, double-first via `(sites Start)`) | `…/chess/Chess.lud` |
| Rover/Pilot limited slide `(between (max 1) …)` = move 1 or 2, no jump | `…/race/fill/Agon.lud` |
| 2 activations/turn via `(then (moveAgain))` | `…/space/line/Connect6.lud` |
| 3D board as a flattened tall rectangle, vertical links via `(ahead … steps:N)` | `…/space/line/3D Tic-Tac-Toe.lud` |

Remaining `[CHK]`/`[HARD]` tags mark the spots still needing compiler iteration
even though the surrounding syntax is grounded — chiefly: the pawn double-step
define (paste Chess's `DoubleStepForwardToEmpty` verbatim), and whether a
piece-level `(then …)` composes cleanly with the play-level 2-activation control.

## Iteration loop for the Ludii spec (on your machine)

0. Install Java + Ludii:
   ```bash
   brew install openjdk           # Ludii needs a JRE/JDK
   # download Ludii.jar from https://ludii.games/download.php
   java -jar Ludii.jar            # launches Ludii Studio
   ```
1. Open `ai-research/skyflag.lud` in Ludii Studio (File → Load Game). Get
   **Stage A** (single-layer) to **compile**, fixing the `[CHK]`/`[HARD]` spots
   against the Ludii language reference + the cited source files.
2. Build a **1-layer perft** from the TS engine (restrict `moves.ts` to one
   layer) and match it in Ludii first (Ludii: Tools → tree estimation, or the
   headless `eval.Perft`).
3. Add **Stage B** (3 layers + lifts + per-layer flags + Nexus) using the
   flattened-rectangle model. Match the full perft table in `RULES.md §8`
   (4 / 17 / 68 / 289 / 2499). The shallowest depth that disagrees localises the
   rule bug — in the spec **or** in `src/game`.
4. Once perft matches, run Ludii's **MCTS** for balance metrics and compare to
   `npm run analyze balance` / `strong`. Differences are design signal.
5. Optional: use Ludii MCTS as a **sparring opponent / label source** to probe
   the residual d4-vs-d3 NNUE weakness — first confirm via Ludii whether it's an
   engine bug or correct play in an asymmetric position.

## Reconciliation items (from RULES.md §9)

1. Turn-limit **tiebreakers** (rulebook §7) are unimplemented — currently a flat
   draw. Decide: spec the tiebreakers, or match the code.
2. Stale Pilot **"jump-capture"** comment in `reducer.ts` vs the no-jump Pilot
   move. Current behaviour: no jump, no intermediate capture.
3. Rulebook prose may still say Soldiers promote on the **Ground** row and
   pieces **enter on the floor** — both superseded by the June-9 code.
