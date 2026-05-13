# Thresan: Skyflag

A two-player tactical race played across a three-layer arcology — Ground (Terran), Sky (Meridian), and Space (Empyrean). Each player commands four pieces (Captain, Soldier, Rover, Pilot) and must capture the opponent's three claim-flags, then land their Captain on the Caelum Nexus at Space(3,3) to win.

Brand: **Thresan** is the game (the threefold proof of the Aetheri Law of Three; rules-level identity, like chess). **Skyflag** is its current edition — the pieces, the boards, and the storyboard set in the world of **Kaleo**. Future editions keep the rules of Thresan and change the storyboard.

This repository contains the **web prototype** — a React + TypeScript + Vite implementation of the v19.1 *Cross-Board* rulebook, intended to wrap into a Capacitor-based iOS app once Phase 1 (single-player and hot-seat) is solid.

> Game design and rulebook © 2026 Limnology Research Corp. · Dr. Nelson Jatel, P.Ag.

## Status

Phase 1 prototype, very early. What renders today:

- All three boards (Space → Sky → Ground), each a 6×6 grid with `r0–r5` / `c0–c5` coordinate labels matching the rulebook
- Static landmarks: 12 Lifts, 6 starting Flags, 1 Nexus, both deploy cells
- In-hand piece trays for both players
- HUD showing whose turn it is, activations remaining, and turn count

What does **not** work yet: piece deployment, movement, capture, win checks, or any actual game logic. Game state is defined (`src/game/`) but not yet driven by user actions.

## Running locally

Requirements: Node 20+, npm 10+.

```sh
npm install
npm run dev
```

Then open http://localhost:5173/.

Other scripts:

- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## Project layout

```
docs/
  rulebook-v20.pdf        Canonical rulebook (Skyflag edition)
src/
  App.tsx                 Top-level layout: HUD, boards, trays
  Board.tsx               One 6×6 SVG board with markers and deploy cells
  PieceTray.tsx           In-hand pieces for one player
  StatusBar.tsx           Turn / activations / outcome HUD
  game/
    types.ts              Layer, Coord, Player, Piece, GameState, etc.
    constants.ts          Lift / flag / deploy positions and createInitialGameState()
```

## Tech stack

- **React 19** with TypeScript for the UI
- **Vite** for the dev server and build
- **SVG** for board rendering (no Three.js — the prototype stays 2D)
- **Capacitor** (planned, Phase 2) to package for iOS

## License

All game design, rules text, illustrations, and game-specific code are the property of Limnology Research Corp. and not licensed for redistribution.
