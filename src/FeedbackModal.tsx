// Feedback modal — tester-facing form that sends a row to the
// `feedback` table (migration 025). Submit logic and category
// metadata live in src/game/feedback.ts; this component is pure UI.
//
// Why not just an email link: an email asks the tester to write a
// subject + remember to attach the URL + sometimes opens an unfamiliar
// mail client. A modal that auto-captures context lowers friction
// to the point where testers actually submit — the single biggest
// determinant of "did we get useful feedback".

import { useEffect, useState } from 'react';
import {
  CATEGORY_LABELS,
  submitFeedback,
  type FeedbackCategory,
} from './game/feedback';

type Props = {
  open: boolean;
  onClose: () => void;
  // Logged-in user id (or null for guests). RLS rejects rows whose
  // user_id doesn't match auth.uid(), so we pass the live value
  // straight through.
  userId: string | null;
};

export default function FeedbackModal({ open, onClose, userId }: Props) {
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Reset form state every time the modal opens — otherwise a
  // previously-submitted form stays in the "thanks" state, and the
  // user can't send a second piece of feedback without a refresh.
  useEffect(() => {
    if (!open) return;
    setCategory('bug');
    setMessage('');
    setError(null);
    setSubmitted(false);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const r = await submitFeedback(category, message, userId);
    setSubmitting(false);
    if (r.ok) {
      setSubmitted(true);
    } else {
      setError(r.message);
    }
  };

  return (
    <div className="account-overlay" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <div className="account-card">
        <div className="account-header">
          <h2 className="account-title" id="feedback-title">Send feedback</h2>
          <button
            type="button"
            className="account-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {submitted ? (
          <>
            <p className="account-intro">
              Thank you — feedback received. If we have follow-up
              questions, you'll hear from us at the email tied to
              your account.
            </p>
            <div className="account-actions">
              <button
                type="button"
                className="end-game-btn"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="hud-btn hud-btn-subtle"
                onClick={() => setSubmitted(false)}
              >
                Send another
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit} className="account-feedback-form">
            <p className="account-intro">
              Found a bug, hit a confusing moment, have an idea?
              Tell us — every report shapes the next build. We
              capture the page URL and your browser automatically,
              so you don't need to include those.
            </p>

            <label htmlFor="feedback-category" className="account-label">
              Type
            </label>
            <select
              id="feedback-category"
              className="account-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            >
              {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_LABELS[k].label} — {CATEGORY_LABELS[k].description}
                </option>
              ))}
            </select>

            <label htmlFor="feedback-message" className="account-label">
              What happened? (or what would you like to see?)
            </label>
            <textarea
              id="feedback-message"
              className="account-input account-feedback-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={5000}
              required
              placeholder="The Captain refused to move from Sky(2,3)…"
              autoFocus
            />

            {error && <p className="account-message account-message--error">{error}</p>}

            <div className="account-actions">
              <button
                type="submit"
                className="end-game-btn"
                disabled={submitting || message.trim().length === 0}
              >
                {submitting ? 'Sending…' : 'Send feedback'}
              </button>
              <button
                type="button"
                className="hud-btn hud-btn-subtle"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
