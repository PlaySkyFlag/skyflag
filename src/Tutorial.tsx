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
//   3 Second activation   — another deploy/move (turn auto-ends after this)
//   4 Last tips           — manual "Got it" button to finish

type Props = {
  state: GameState;
  open: boolean;
  onClose: () => void;
};

const TOTAL_STAGES = 5;
const FINAL_STAGE = TOTAL_STAGES - 1;

const STAGE_TITLES: Record<number, string> = {
  0: 'Welcome to Thresan™: Skyflag',
  1: 'How to win',
  2: 'Try your first activation',
  3: 'Now your second activation',
  4: 'You’re playing!',
};

export default function Tutorial({ state, open, onClose }: Props) {
  const [stage, setStage] = useState(0);

  // Track how many history entries we've already considered so we don't
  // reapply old advances when state churns. Reset only when the tutorial
  // OPENS (not on every history change).
  const seenLen = useRef(state.history.length);
  useEffect(() => {
    if (open) {
      setStage(0);
      seenLen.current = state.history.length;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Advance stages by watching history. Auto-advance only fires from the
  // gameplay stages (2-3). Final tips stage (4) requires manual Got it.
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
              <strong>Promotion:</strong> a Soldier (<span className="tut-glyph">♟</span>) that
              reaches the far row of <em>Terran</em> (the opponent's back rank,
              where their flag started) immediately promotes to a Captain
              (<span className="tut-glyph">♚</span>). Promoted Captains move
              and capture flags exactly like your starting Captain — a great
              way to add more flag-runners or replace a fallen Captain.
            </p>
            <p className="tut-aside">
              The game ends in a draw if turn 30 is reached without a winner.
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
              then tap the dashed <em>deploy pad</em> on the Meridian — the
              middle layer.
            </p>
            <p>
              <strong>Move:</strong> tap a piece on the board, then tap a gold
              dot to move there.
            </p>
            <p className="tut-aside">
              Your turn ends automatically once both activations are spent —
              no End Turn button needed.
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
            <p className="tut-aside">
              Once you spend it, your turn passes to your opponent
              automatically.
            </p>
          </>
        );
      case 4:
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
              Re-open this tutorial any time from the <em>🎓 Tutorial</em>
              tab in the panel strip below the boards.
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
