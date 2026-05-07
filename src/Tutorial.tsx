import { useEffect, useRef, useState } from 'react';
import type { GameState } from './game/types';

// Interactive guided first-game tutorial. Shows a non-blocking tip card
// in the bottom-right corner of the page that watches the player's
// actions and auto-advances through stages as they complete each one.
//
// Stages (advance trigger in parens):
//   0 Welcome             — manual "Begin" button
//   1 How to win          — manual Next button (info-only)
//   2 First activation    — player records any deploy/move (history grows)
//   3 Second activation   — another deploy/move
//   4 End your turn       — an end-turn entry appears
//   5 Last tips           — manual "Got it" button to finish

type Props = {
  state: GameState;
  open: boolean;
  onClose: () => void;
};

const TOTAL_STAGES = 6;
const FINAL_STAGE = TOTAL_STAGES - 1;

const STAGE_TITLES: Record<number, string> = {
  0: 'Welcome to SkyFlag',
  1: 'How to win',
  2: 'Try your first activation',
  3: 'Now your second activation',
  4: 'End your turn',
  5: 'You’re playing!',
};

export default function Tutorial({ state, open, onClose }: Props) {
  const [stage, setStage] = useState(0);

  // Track how many history entries we've already considered so we don't
  // reapply old advances when state churns. Reset whenever the tutorial
  // re-opens so every fresh launch starts from the current history len.
  const seenLen = useRef(state.history.length);
  useEffect(() => {
    if (open) {
      setStage(0);
      seenLen.current = state.history.length;
    }
  }, [open, state.history.length]);

  // Advance stages by watching history. Auto-advance only fires from the
  // gameplay stages (2-4) — the info stages (0, 1) and the final tips
  // stage (5) require manual Next/Got it.
  useEffect(() => {
    if (!open) return;
    if (stage < 2 || stage >= FINAL_STAGE) return;
    const len = state.history.length;
    if (len <= seenLen.current) return;
    let nextStage = stage;
    for (let i = seenLen.current; i < len; i++) {
      const entry = state.history[i];
      if (nextStage === 2 && (entry.kind === 'deploy' || entry.kind === 'move')) {
        nextStage = 3;
      } else if (nextStage === 3 && (entry.kind === 'deploy' || entry.kind === 'move')) {
        nextStage = 4;
      } else if (nextStage === 4 && entry.kind === 'end-turn') {
        nextStage = 5;
      }
    }
    seenLen.current = len;
    if (nextStage !== stage) setStage(nextStage);
  }, [open, stage, state.history.length, state.history]);

  if (!open) return null;

  const body = (() => {
    switch (stage) {
      case 0:
        return (
          <>
            <p>
              I'll guide you through your first turn. Three boards stacked —
              <strong> Terran</strong>, <strong>Meridian</strong>,{' '}
              <strong>Empyrean</strong> — and you'll command one of two clans:
              the Grey Ravens or the White Stags.
            </p>
            <p>Tap <em>Begin</em> when you're ready.</p>
          </>
        );
      case 1:
        return (
          <>
            <p>You can win in two ways:</p>
            <ul>
              <li>
                <strong>Capture all three enemy flags</strong>{' '}
                (<span className="tut-glyph">⚑</span>) — one on each layer —
                with your Captain (<span className="tut-glyph">♚</span>) or a
                promoted Soldier, <em>then</em> move a Captain onto the{' '}
                <strong>Nexus</strong> at the centre of Empyrean.
              </li>
              <li>
                <strong>Eliminate every opposing Captain</strong> (capture
                them by landing on them).
              </li>
            </ul>
            <p>
              The game ends in a draw if turn 30 is reached without a winner.
            </p>
            <p className="tut-aside">
              You'll start with a fresh tray of pieces — deploy them onto
              Terran, then push toward the enemy's territory. Lifts let you
              cross between layers (more on those soon).
            </p>
          </>
        );
      case 2:
        return (
          <>
            <p>
              You have <strong>2 activations</strong> this turn. An activation
              is either a <strong>deploy</strong> or a <strong>move</strong>.
            </p>
            <p>
              <strong>Deploy:</strong> tap a piece in your tray below the board,
              then tap the dashed <em>deploy pad</em> on Terran.
            </p>
            <p>
              <strong>Move:</strong> tap a piece on the board, then tap a gold
              dot to move there.
            </p>
          </>
        );
      case 3:
        return (
          <>
            <p>Nice — that was activation 1.</p>
            <p>
              Now use your <strong>second activation</strong>. Try a different
              piece this time, or deploy another, or move the one you just
              placed.
            </p>
          </>
        );
      case 4:
        return (
          <>
            <p>You've spent both activations.</p>
            <p>
              Click <strong>"End turn"</strong> in the HUD to pass play to your
              opponent. (Unused activations are forfeited.)
            </p>
          </>
        );
      case 5:
        return (
          <>
            <p>
              <strong>Cyan arrow</strong> = opponent's last move.
              <strong> Red ring</strong> = your piece is in capture range —
              move it or defend it.
            </p>
            <p>
              <strong>Lifts</strong> (<span className="tut-glyph">↕</span>) take
              two activations to cross — move onto the lift, then on a later
              activation tap the same cell on a different layer.
            </p>
            <p>
              Re-open this tutorial any time from the <em>Tutorial</em> button
              in the help row.
            </p>
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="tutorial-card" role="dialog" aria-live="polite">
      <div className="tutorial-header">
        <span className="tutorial-progress">{stage + 1} / {TOTAL_STAGES}</span>
        <button
          type="button"
          className="tutorial-skip"
          onClick={onClose}
          aria-label="Skip tutorial"
        >
          Skip
        </button>
      </div>
      <h3 className="tutorial-title">{STAGE_TITLES[stage]}</h3>
      <div className="tutorial-body">{body}</div>
      <div className="tutorial-actions">
        {stage > 0 && stage < FINAL_STAGE && (
          <button
            type="button"
            className="end-game-btn end-game-btn--subtle"
            onClick={() => setStage((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
        )}
        {stage === 0 && (
          <button type="button" className="end-game-btn" onClick={() => setStage(1)}>
            Begin
          </button>
        )}
        {stage > 0 && stage < FINAL_STAGE && (
          <button
            type="button"
            className="end-game-btn"
            onClick={() => setStage((s) => Math.min(FINAL_STAGE, s + 1))}
          >
            Next
          </button>
        )}
        {stage === FINAL_STAGE && (
          <button type="button" className="end-game-btn" onClick={onClose}>
            Got it
          </button>
        )}
      </div>
    </div>
  );
}
