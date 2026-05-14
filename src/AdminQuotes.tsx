// Admin curation surface for testimonial quotes captured via the
// post-game funnel. Gated behind public.is_admin() — a non-admin
// who hits /admin/quotes either sees the sign-in prompt or the
// "not authorized" state; RLS on the quotes table provides the
// real security boundary, this UI just hides what they can't read.
//
// Curation actions: approve (mark as suitable feedback), feature
// (surface on the Landing hero rotation), unfeature, and delete
// (hard remove — for spam / unusable). A quote needs all three of
// approved + featured + consent_to_share=true to be publicly
// visible; the public RLS policy enforces this together.

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './game/supabase';
import './AdminQuotes.css';

type Quote = {
  id: string;
  created_at: string;
  quote: string;
  name: string | null;
  city: string | null;
  email: string | null;
  consent_to_share: boolean;
  approved: boolean;
  featured: boolean;
  source: string;
  game_outcome: string | null;
};

type Filter = 'all' | 'pending' | 'approved' | 'featured';

export default function AdminQuotes() {
  const [authState, setAuthState] = useState<
    'loading' | 'signed-out' | 'not-admin' | 'admin'
  >('loading');
  const [user, setUser] = useState<User | null>(null);

  // Auth check — fetches the current session and then asks the
  // server via is_admin() whether this user is the admin.
  useEffect(() => {
    if (!supabase) {
      setAuthState('signed-out');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      if (cancelled) return;
      setUser(sessionUser);
      if (!sessionUser) {
        setAuthState('signed-out');
        return;
      }
      const { data: isAdminData } = await supabase.rpc('is_admin');
      if (cancelled) return;
      setAuthState(isAdminData === true ? 'admin' : 'not-admin');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === 'loading') {
    return (
      <div className="admin-quotes-shell">
        <p className="admin-quotes-state">Checking access…</p>
      </div>
    );
  }
  if (authState === 'signed-out') {
    return (
      <div className="admin-quotes-shell">
        <h1 className="admin-quotes-title">Quotes</h1>
        <p className="admin-quotes-state">
          Sign in at <a href="/play">/play</a> first, then return to this page.
        </p>
      </div>
    );
  }
  if (authState === 'not-admin') {
    return (
      <div className="admin-quotes-shell">
        <h1 className="admin-quotes-title">Quotes</h1>
        <p className="admin-quotes-state">Not authorized.</p>
      </div>
    );
  }
  return <QuotesTable user={user!} />;
}

function QuotesTable({ user: _user }: { user: User }) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from('quotes')
      .select(
        'id, created_at, quote, name, city, email, consent_to_share, approved, featured, source, game_outcome',
      )
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setQuotes((data ?? []) as Quote[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (id: string, patch: Partial<Quote>) => {
    if (!supabase) return;
    setBusyId(id);
    const { error: err } = await supabase
      .from('quotes')
      .update(patch)
      .eq('id', id);
    setBusyId(null);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  };

  const remove = async (id: string) => {
    if (!supabase) return;
    if (!confirm('Delete this quote? This cannot be undone.')) return;
    setBusyId(id);
    const { error: err } = await supabase.from('quotes').delete().eq('id', id);
    setBusyId(null);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // older browsers — ignore silently
    }
  };

  const filtered = (quotes ?? []).filter((q) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !q.approved;
    if (filter === 'approved') return q.approved && !q.featured;
    if (filter === 'featured') return q.featured;
    return true;
  });

  return (
    <div className="admin-quotes-shell">
      <header className="admin-quotes-header">
        <h1 className="admin-quotes-title">Quotes</h1>
        <p className="admin-quotes-summary">
          {quotes ? `${quotes.length} total · ${filtered.length} shown` : 'Loading…'}
        </p>
      </header>

      <div className="admin-quotes-filters">
        {(['pending', 'approved', 'featured', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={
              'admin-quotes-filter' + (filter === f ? ' admin-quotes-filter--active' : '')
            }
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <p className="admin-quotes-error">Error: {error}</p>}

      {filtered.length === 0 && quotes && (
        <p className="admin-quotes-empty">No quotes in this view.</p>
      )}

      <ul className="admin-quotes-list">
        {filtered.map((q) => (
          <li key={q.id} className="admin-quotes-item">
            <blockquote className="admin-quotes-quote">"{q.quote}"</blockquote>
            <p className="admin-quotes-attribution">
              {q.name || '(no name)'}{q.city ? `, ${q.city}` : ''}
              {' · '}
              <span className="admin-quotes-meta">
                {new Date(q.created_at).toLocaleString()} · {q.source}
                {q.game_outcome ? ` · ${q.game_outcome}` : ''}
                {q.email ? ` · ${q.email}` : ''}
              </span>
            </p>
            <div className="admin-quotes-flags">
              {q.approved && <span className="admin-quotes-flag">approved</span>}
              {q.featured && (
                <span className="admin-quotes-flag admin-quotes-flag--featured">
                  featured
                </span>
              )}
              {q.consent_to_share ? (
                <span className="admin-quotes-flag admin-quotes-flag--consent">
                  consent ✓
                </span>
              ) : (
                <span className="admin-quotes-flag admin-quotes-flag--noconsent">
                  no consent
                </span>
              )}
            </div>
            <div className="admin-quotes-actions">
              {!q.approved ? (
                <button
                  type="button"
                  className="admin-quotes-btn"
                  disabled={busyId === q.id}
                  onClick={() => update(q.id, { approved: true })}
                >
                  Approve
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-quotes-btn admin-quotes-btn--subtle"
                  disabled={busyId === q.id}
                  onClick={() => update(q.id, { approved: false, featured: false })}
                >
                  Unapprove
                </button>
              )}
              {q.approved && q.consent_to_share && !q.featured && (
                <button
                  type="button"
                  className="admin-quotes-btn admin-quotes-btn--feature"
                  disabled={busyId === q.id}
                  onClick={() => update(q.id, { featured: true })}
                >
                  Feature
                </button>
              )}
              {q.featured && (
                <button
                  type="button"
                  className="admin-quotes-btn admin-quotes-btn--subtle"
                  disabled={busyId === q.id}
                  onClick={() => update(q.id, { featured: false })}
                >
                  Unfeature
                </button>
              )}
              <button
                type="button"
                className="admin-quotes-btn admin-quotes-btn--subtle"
                onClick={() => copy(q.quote)}
              >
                Copy
              </button>
              <button
                type="button"
                className="admin-quotes-btn admin-quotes-btn--danger"
                disabled={busyId === q.id}
                onClick={() => remove(q.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
