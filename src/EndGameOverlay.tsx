import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { sendRequest } from './game/friends';
import { supabase } from './game/supabase';
import type { GameState, GameStatus, RoomState } from './game/types';
import { FACTION_NAME } from './game/factions';
import { stashReviewSession } from './game/reviewSession';
import ConsentCheckbox from './ConsentCheckbox';
import { getUtmSource } from './utmSource';
import { track } from '@vercel/analytics';
import { campaignCta, campaignUrl, currentPhase } from './campaign';

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

// Display names live in one canonical place (src/game/factions.ts) —
// this used to be a hand-rolled, INVERTED copy that told the winner the
// other faction had won.
const PLAYER_NAME = FACTION_NAME;

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
      try {
        const { data } = await supabase
          .from('games')
          .select('p1_id, p2_id')
          .eq('room_code', room.code)
          .maybeSingle();
        if (cancelled || !data) return;
        const { p1_id, p2_id } = data as { p1_id: string; p2_id: string | null };
        const other = p1_id === user.id ? p2_id : p1_id;
        setOpponentId(other ?? null);
      } catch {
        // Network failure looking up the opponent is non-fatal — the
        // end-game screen still renders without the opponent's name.
        // Never let this reject and trip the global rejection handler.
        if (!cancelled) setOpponentId(null);
      }
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
  const [emailConsent, setEmailConsent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Quote-stage state — first name + city are optional, consent gates
  // public surfacing.
  const [quote, setQuote] = useState('');
  const [firstName, setFirstName] = useState('');
  const [city, setCity] = useState('');
  const [consent, setConsent] = useState(false);

  // Denominator for post-game conversion. Fires once per mount, only
  // when the block is actually rendered (a player who already went
  // through the funnel is 'dismissed' and never counted), so
  // postgame_follow_click / postgame_email_submit divide by a real
  // "was shown it" population rather than by games completed.
  const shown = phase !== 'dismissed';
  useEffect(() => {
    if (shown) track('postgame_shown', {});
  }, [shown]);

  if (phase === 'dismissed') return null;

  const handleWaitlistSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setPhase('waitlist-error');
      setErrorMsg('Please enter a valid email.');
      return;
    }
    if (!emailConsent) {
      setPhase('waitlist-error');
      setErrorMsg('Please tick the consent box so we can email you.');
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
        utm_source: getUtmSource(),
        consent: true,
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
    track('waitlist_signup', { source: 'skyflag-postgame', placement: 'postgame' });
    track('postgame_email_submit', {});
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
  //
  // The single highest-intent moment in the whole funnel: someone has
  // just finished a full game. Follow is PRIMARY (a Kickstarter
  // follower converts to a backer far better than an email subscriber,
  // and it costs the visitor one tap with no typing); email is the
  // secondary ask for people who won't leave the page. Both are above
  // the fold at 380px. Never rendered mid-game, and dismissing leaves
  // the rematch button untouched.
  const phaseNow = currentPhase();
  const isLive = phaseNow === 'LIVE';
  return (
    <section className="end-game-waitlist" aria-label="Back the Kickstarter">
      <p className="end-game-waitlist-title">
        You just played a full game of Thresan.
      </p>
      <p className="end-game-waitlist-lead">
        {isLive ? (
          <>The physical edition is funding on Kickstarter right now.</>
        ) : (
          <>
            That puts you ahead of nearly everyone who will back it. The
            physical edition launches on Kickstarter, October 27.
          </>
        )}
      </p>

      <a
        href={campaignUrl(phaseNow, 'postgame')}
        target="_blank"
        rel="noopener noreferrer"
        className="end-game-btn end-game-waitlist-follow"
        onClick={() => track('postgame_follow_click', { phase: phaseNow })}
      >
        {campaignCta(phaseNow)}
      </a>
      <p className="end-game-waitlist-microcopy">
        {isLive
          ? 'Campaign closes November 27.'
          : 'One tap, free. One notification on launch day.'}
      </p>

      <p className="end-game-waitlist-or">
        Or take the launch note by email instead:
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
        <ConsentCheckbox
          checked={emailConsent}
          onChange={setEmailConsent}
          disabled={phase === 'waitlist-submitting'}
        />
        <button
          type="submit"
          className="end-game-btn end-game-waitlist-submit"
          disabled={phase === 'waitlist-submitting'}
        >
          {phase === 'waitlist-submitting' ? 'Joining…' : 'Send it'}
        </button>
      </form>
      {phase === 'waitlist-error' && (
        <p className="end-game-waitlist-error">{errorMsg}</p>
      )}
      <p className="end-game-waitlist-microcopy">
        A handful of notes between now and launch. Nothing else, ever.
      </p>
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
