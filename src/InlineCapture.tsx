// InlineCapture — a self-contained email-capture form for the shared
// conversion band. Best practice: capture where attention already is,
// rather than bouncing the visitor to a separate page (every extra click
// sheds signups). Writes to the same thresan_waitlist table + tags as the
// /kickstarter page, so the Kit sync and CRM see these identically.
//
// Compliance: the consent checkbox is required (CASL/GDPR) and styled as
// the obvious mandatory field — the marketing sync only fires when
// consent IS TRUE, so we never sync someone who didn't opt in.
//
// Inline styles + inherited text color so it adapts to whatever surface
// (light or dark) it's dropped into, matching KickstarterCTA's approach.

import { useState, type FormEvent } from 'react';
import { track } from '@vercel/analytics';
import { supabase } from './game/supabase';

const GOLD = '#c2a46b';
const AMBER = '#e8a23c';

export default function InlineCapture({
  source = 'thresan-kickstarter',
}: {
  source?: string;
}) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
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
    if (!consent) {
      setStatus('error');
      setError('Please tick the box so we can email you.');
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
        interests: ['backing'],
        consent: true,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      });
    // 23505 = duplicate; treat as success so the form can't probe the list.
    if (insertError && insertError.code !== '23505') {
      setStatus('error');
      setError("Couldn't save your email. Please try again.");
      return;
    }
    track('waitlist_signup', { source, placement: 'inline' });
    setStatus('success');
  };

  if (status === 'success') {
    return (
      <p
        role="status"
        aria-live="polite"
        style={{ margin: '8px 0 0', fontWeight: 600, fontSize: '1rem' }}
      >
        You're on the list — watch your inbox.{' '}
        <a href="https://thresan.studio/volume-zero" style={{ color: GOLD }}>
          Read the free prequel →
        </a>
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 420,
        margin: '0 auto',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          disabled={status === 'submitting'}
          required
          style={{
            flex: '1 1 200px',
            minWidth: 0,
            padding: '11px 14px',
            borderRadius: 8,
            border: '1px solid rgba(194,164,107,0.5)',
            background: 'rgba(0,0,0,0.18)',
            color: 'inherit',
            fontSize: '1rem',
          }}
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          style={{
            padding: '11px 22px',
            borderRadius: 8,
            border: 'none',
            background: GOLD,
            color: '#0b0e13',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'submitting' ? 'Joining…' : 'Get the launch email'}
        </button>
      </div>

      {/* Mandatory consent — set apart in amber, the convention for a
          required opt-in (Substack / ConvertKit / Mailchimp). */}
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 9,
          fontSize: '0.82rem',
          lineHeight: 1.4,
          padding: '9px 11px',
          borderRadius: 8,
          background:
            status === 'error' && !consent
              ? 'rgba(232,138,138,0.12)'
              : 'rgba(232,162,60,0.09)',
          border: `1px solid ${
            status === 'error' && !consent ? '#e88a8a' : 'rgba(232,162,60,0.5)'
          }`,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          style={{ marginTop: 2, width: 16, height: 16, accentColor: AMBER, flexShrink: 0 }}
        />
        <span>
          <strong
            style={{
              display: 'inline-block',
              background: AMBER,
              color: '#1a1205',
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '1px 6px',
              borderRadius: 4,
              marginRight: 6,
              verticalAlign: 1,
            }}
          >
            Required
          </strong>
          Yes, email me about Thresan and the Kickstarter launch. Tick to
          subscribe — unsubscribe anytime.
        </span>
      </label>

      {status === 'error' && (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#e88a8a' }}>{error}</p>
      )}
    </form>
  );
}
