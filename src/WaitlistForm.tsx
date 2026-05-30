// WaitlistForm — shared email capture used across the thresan.* surfaces.
// Inserts into the thresan_waitlist table with a per-surface `source` tag
// so signups are attributable to the page they came from. A duplicate
// insert (Postgres 23505) is treated as success so the form can't be used
// to probe which emails are already on the list. Self-contained dark/gold
// styling (wl-*) suits every thresan.* palette.
//
// ThresanStore and ThresanStudio keep their own bespoke, tightly-styled
// forms; this component is for the surfaces that previously had no capture
// at all (thresan.games, thresan.io, thresan.com).

import { useState, type FormEvent } from 'react';
import { supabase } from './game/supabase';
import './WaitlistForm.css';

type WaitlistFormProps = {
  /** Attribution tag stored with the signup, e.g. 'thresan-games'. */
  source: string;
  heading?: string;
  lead?: string;
  buttonLabel?: string;
  placeholder?: string;
  /** Trailing sentence after the bold "You're on the list." */
  successText?: string;
  /** Extra class on the wrapper for per-surface spacing tweaks. */
  className?: string;
};

export default function WaitlistForm({
  source,
  heading = 'Get the launch email',
  lead = "One email when the Kickstarter goes live. That's the only thing the list is for.",
  buttonLabel = 'Join waitlist',
  placeholder = 'you@example.com',
  successText = "We'll be in touch when the campaign launches.",
  className,
}: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] =
    useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setStatus('error');
      setError('Please enter a valid email.');
      return;
    }
    if (!supabase) {
      setStatus('error');
      setError("Couldn't reach the list right now. Please try again later.");
      return;
    }
    setStatus('submitting');
    setError('');
    const { error: insertError } = await supabase
      .from('thresan_waitlist')
      .insert({
        email: trimmed,
        source,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      });
    if (insertError && insertError.code !== '23505') {
      setStatus('error');
      setError("Couldn't save your email. Please try again.");
      return;
    }
    setStatus('success');
  };

  return (
    <section className={`wl${className ? ` ${className}` : ''}`}>
      <h2 className="wl-title">{heading}</h2>
      <p className="wl-lead">{lead}</p>
      {status === 'success' ? (
        <div
          className="wl-success"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong>You&rsquo;re on the list.</strong> {successText}
        </div>
      ) : (
        <form className="wl-form" onSubmit={handleSubmit} noValidate>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            className="wl-input"
            disabled={status === 'submitting'}
            required
            aria-label="Email address"
          />
          <button
            type="submit"
            className="wl-button"
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Joining…' : buttonLabel}
          </button>
          {status === 'error' && <p className="wl-error">{error}</p>}
        </form>
      )}
    </section>
  );
}
