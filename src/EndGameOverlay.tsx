import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { sendRequest } from './game/friends';
import { supabase } from './game/supabase';
import type { GameState, GameStatus, Player, RoomState } from './game/types';
import { stashReviewSession } from './game/reviewSession';

// Persists the user's response to the post-game funnel (waitlist signup
// AND optional testimonial quote). Either is dismissable; once the user
// has been through the funnel once — submitted, skipped, or "not now"'d
// — don't ask again. Per Stegmaier's "value first, ask once" principle.
const WAITLIST_HANDLED_KEY = 'skyflag.thresan-waitlist.postgame-handled';

function getInitialWaitlistStatus(): 'idle' | 'dismissed' {
  try {
    return localStorage.getItem(WAITLIST_HANDLED_KEY) ? 'dismissed' : 'idle';
  } catch {
    // Private mode or storage disabled — show the offer; treat each
    // game-end as a fresh ask.
    return 'idle';
  }
}

function markWaitlistHandled(): void {
  try {
    localStorage.setItem(WAITLIST_HANDLED_KEY, 'done');
  } catch {
    /* private mode — fine */
  }
}

const PLAYER_NAME: Record<Player, string> = { p1: 'Grey Ravens', p2: 'White Stags' };

// See StatusBar.tsx for why we derive these from GameStatus rather
// than spelling the union out by hand.
type WonReason = Extract<GameStatus, { kind: 'won' }>['reason'];
type DrawReason = Extract<GameStatus, { kind: 'draw' }>['reason'];

const REASON_LABEL: Record<WonReason | DrawReason, string> = {
  nexus: 'Nexus capture',
  elimination: 'elimination',
  resignation: 'resignation',
  'time-out': 'time-out — opponent ran out of time',
  'turn-limit': 'turn limit reached',
  stalemate: 'stalemate — no legal moves left',
  agreement: 'mutual agreement',
};

type Props = {
  state: GameState;
  user: User | null;
  room: RoomState | null;
  onPlayAgain: () => void;
};

// End-game celebration overlay. Renders when the game has finished (won or
// draw) and hasn't been dismissed via "View board". Auto-resets on the
// next game so it shows again when the next game ends.
export default function EndGameOverlay({ state, user, room, onPlayAgain }: Props) {
  const [dismissed, setDismissed] = useState(false);
  // Opponent's user_id, fetched lazily from the games row when this is an
  // MP game. Null for solo / 2P hot-seat or while the lookup is pending.
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendNote, setFriendNote] = useState<string | null>(null);

  useEffect(() => {
    if (state.status.kind === 'in-progress') {
      setDismissed(false);
      setFriendNote(null);
    }
  }, [state.status.kind]);

  // Look up the opponent's user_id once the game has ended in an MP room.
  // We read p1_id / p2_id from the games row and pick whichever isn't us.
  useEffect(() => {
    if (state.status.kind === 'in-progress') return;
    if (!supabase || !user || !room) {
      setOpponentId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('games')
        .select('p1_id, p2_id')
        .eq('room_code', room.code)
        .maybeSingle();
      if (cancelled || !data) return;
      const { p1_id, p2_id } = data as { p1_id: string; p2_id: string | null };
      const other = p1_id === user.id ? p2_id : p1_id;
      setOpponentId(other ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status.kind, user, room]);

  if (state.status.kind === 'in-progress') return null;
  if (dismissed) return null;

  const status = state.status;

  const onAddFriend = async () => {
    if (!user || !opponentId) return;
    setFriendBusy(true);
    const r = await sendRequest(user.id, opponentId);
    setFriendBusy(false);
    if (r.ok) {
      setFriendNote('Friend request sent.');
    } else {
      setFriendNote(r.message);
    }
  };

  return (
    <div className="end-game-overlay" role="dialog" aria-modal="true">
      <div className="end-game-card">
        <h2 className="end-game-title">
          {status.kind === 'won' ? `${PLAYER_NAME[status.winner]} wins!` : 'Draw'}
        </h2>
        <p className="end-game-reason">
          {status.kind === 'won'
            ? `by ${REASON_LABEL[status.reason]}`
            : REASON_LABEL[status.reason]}
        </p>
        {/* Handwritten celebratory rally — Caveat font + slight tilt
            gives the end-game moment a personal, signed-by-the-house
            feel. Only shown on a finished game so it doesn't appear
            during a draw-offer modal or similar mid-game state. */}
        <p className="end-game-rally tagline-script">Three worlds. One proof.</p>
        <div className="end-game-actions">
          <button type="button" className="end-game-btn" onClick={onPlayAgain}>
            Play again
          </button>
          {/* Review opens a dedicated /review/<slug> route that
              walks through every move with engine analysis. The
              session handoff is via sessionStorage so 1P / 2P
              local games (no DB record) can also be reviewed. */}
          <button
            type="button"
            className="end-game-btn end-game-btn--subtle"
            onClick={() => {
              stashReviewSession({
                history: state.history,
                finalState: state,
                roomCode: room?.code,
              });
              // Hard navigation — the /review route is its own lazy
              // chunk and main.tsx dispatches off window.location.
              window.location.assign(
                room ? `/review/${room.code}` : '/review/current',
              );
            }}
          >
            📊 Review this game
          </button>
          {user && opponentId && (
            <button
              type="button"
              className="end-game-btn end-game-btn--subtle"
              disabled={friendBusy || friendNote !== null}
              onClick={onAddFriend}
            >
              {friendNote ? 'Sent ✓' : friendBusy ? 'Sending…' : 'Add as friend'}
            </button>
          )}
          <button
            type="button"
            className="end-game-btn end-game-btn--subtle"
            onClick={() => setDismissed(true)}
          >
            View board
          </button>
        </div>
        {friendNote && <p className="end-game-friend-note">{friendNote}</p>}
        <PostGameWaitlist
          user={user}
          gameOutcome={status.kind === 'won' ? 'won' : status.kind === 'draw' ? 'draw' : 'unknown'}
        />
      </div>
    </div>
  );
}

// Post-game funnel: two sequential asks after a finished game.
//   Stage 1 — waitlist. Quiet email-list offer per Stegmaier's playbook.
//     Submits to public.thresan_waitlist with source='skyflag-postgame'.
//   Stage 2 — testimonial quote. After email signup succeeds we chain
//     into an optional quote capture. The "just finished a satisfying
//     game" moment is the only one where a player will write a quote
//     they actually mean. An hour later they won't. A week later, never.
//     Quotes feed the Landing hero rotation, reviewer outreach, and
//     pre-Kickstarter social proof. Without explicit consent the row
//     stays admin-only — RLS enforces approved + featured + consent
//     before any public read.
//
// User can dismiss at either stage; the funnel is marked handled and
// won't ask again on the same browser/profile.

type FunnelPhase =
  | 'waitlist-idle'
  | 'waitlist-submitting'
  | 'waitlist-error'
  | 'quote-idle'
  | 'quote-submitting'
  | 'quote-error'
  | 'done'
  | 'dismissed';

type Outcome = 'won' | 'lost' | 'draw' | 'unknown';

function PostGameWaitlist({
  user,
  gameOutcome,
}: {
  user: User | null;
  gameOutcome: Outcome;
}) {
  const [phase, setPhase] = useState<FunnelPhase>(() =>
    getInitialWaitlistStatus() === 'dismissed' ? 'dismissed' : 'waitlist-idle',
  );
  const userEmail =
    typeof user?.email === 'string' && user.email.includes('@') ? user.email : '';
  const [email, setEmail] = useState(userEmail);
  const [errorMsg, setErrorMsg] = useState('');

  // Quote-stage state — first name + city are optional, consent gates
  // public surfacing.
  const [quote, setQuote] = useState('');
  const [firstName, setFirstName] = useState('');
  const [city, setCity] = useState('');
  const [consent, setConsent] = useState(false);

  if (phase === 'dismissed') return null;

  const handleWaitlistSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setPhase('waitlist-error');
      setErrorMsg('Please enter a valid email.');
      return;
    }
    if (!supabase) {
      setPhase('waitlist-error');
      setErrorMsg("Couldn't reach the list right now. Try again later.");
      return;
    }
    setPhase('waitlist-submitting');
    setErrorMsg('');
    const { error: insertError } = await supabase
      .from('thresan_waitlist')
      .insert({
        email: trimmed,
        source: 'skyflag-postgame',
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      });
    // 23505 unique-violation = already on the list. Treat as success to
    // avoid surfacing "you already signed up" (signup-status timing leak).
    if (insertError && insertError.code !== '23505') {
      setPhase('waitlist-error');
      setErrorMsg("Couldn't save your email. Try again.");
      return;
    }
    // Don't mark handled yet — give the quote ask its turn first.
    setPhase('quote-idle');
  };

  const handleQuoteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedQuote = quote.trim();
    if (!trimmedQuote) {
      setPhase('quote-error');
      setErrorMsg('Please write something, even a few words.');
      return;
    }
    if (!supabase) {
      setPhase('quote-error');
      setErrorMsg("Couldn't reach the server right now. Try again later.");
      return;
    }
    setPhase('quote-submitting');
    setErrorMsg('');
    const { error: insertError } = await supabase.from('quotes').insert({
      quote: trimmedQuote,
      name: firstName.trim() || null,
      city: city.trim() || null,
      email: email.trim().toLowerCase() || null,
      consent_to_share: consent,
      user_id: user?.id ?? null,
      source: 'postgame',
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      game_outcome: gameOutcome,
    });
    if (insertError) {
      setPhase('quote-error');
      setErrorMsg("Couldn't save your reaction. Try again.");
      return;
    }
    markWaitlistHandled();
    setPhase('done');
  };

  const dismiss = () => {
    markWaitlistHandled();
    setPhase('dismissed');
  };

  const skipQuote = () => {
    markWaitlistHandled();
    setPhase('done');
  };

  // ─── Stage 2 (quote) — after waitlist success or in error retry ───
  if (
    phase === 'quote-idle' ||
    phase === 'quote-submitting' ||
    phase === 'quote-error'
  ) {
    return (
      <section className="end-game-quote" aria-label="Share a reaction">
        <p className="end-game-quote-thanks">
          <strong>You're on the list.</strong> One email when the
          Kickstarter launches — that's it.
        </p>
        <p className="end-game-quote-lead">
          Got ten more seconds? How would you describe Skyflag to a friend?
        </p>
        <form
          className="end-game-quote-form"
          onSubmit={handleQuoteSubmit}
          noValidate
        >
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="One sentence is plenty."
            className="end-game-quote-textarea"
            disabled={phase === 'quote-submitting'}
            rows={2}
            maxLength={500}
            aria-label="Your reaction"
          />
          <div className="end-game-quote-fields">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name (optional)"
              className="end-game-quote-input"
              disabled={phase === 'quote-submitting'}
              maxLength={40}
              aria-label="First name"
            />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (optional)"
              className="end-game-quote-input"
              disabled={phase === 'quote-submitting'}
              maxLength={60}
              aria-label="City"
            />
          </div>
          <label className="end-game-quote-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={phase === 'quote-submitting'}
            />
            <span>OK to share publicly with my first name + city.</span>
          </label>
          <div className="end-game-quote-actions">
            <button
              type="submit"
              className="end-game-btn end-game-waitlist-submit"
              disabled={phase === 'quote-submitting'}
            >
              {phase === 'quote-submitting' ? 'Sending…' : 'Share'}
            </button>
            <button
              type="button"
              className="end-game-waitlist-dismiss"
              onClick={skipQuote}
              disabled={phase === 'quote-submitting'}
            >
              Skip
            </button>
          </div>
        </form>
        {phase === 'quote-error' && (
          <p className="end-game-waitlist-error">{errorMsg}</p>
        )}
      </section>
    );
  }

  // ─── Done — both stages handled ───────────────────────────────
  if (phase === 'done') {
    return (
      <div className="end-game-waitlist end-game-waitlist--done">
        <p>
          <strong>Thank you.</strong> Every reaction shapes the launch.
        </p>
      </div>
    );
  }

  // ─── Stage 1 (waitlist idle / submitting / error) ─────────────
  return (
    <section className="end-game-waitlist" aria-label="Kickstarter waitlist">
      <p className="end-game-waitlist-lead">
        Liked the game? Get the email when the physical edition
        launches on Kickstarter. One email. That's it.
      </p>
      <form
        className="end-game-waitlist-form"
        onSubmit={handleWaitlistSubmit}
        noValidate
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="end-game-waitlist-input"
          disabled={phase === 'waitlist-submitting'}
          required
          aria-label="Email address"
        />
        <button
          type="submit"
          className="end-game-btn end-game-waitlist-submit"
          disabled={phase === 'waitlist-submitting'}
        >
          {phase === 'waitlist-submitting' ? 'Joining…' : 'Join'}
        </button>
      </form>
      {phase === 'waitlist-error' && (
        <p className="end-game-waitlist-error">{errorMsg}</p>
      )}
      <button
        type="button"
        className="end-game-waitlist-dismiss"
        onClick={dismiss}
      >
        Not now
      </button>
    </section>
  );
}
