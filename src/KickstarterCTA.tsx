// KickstarterCTA — a shared, self-contained conversion band dropped near
// the footer of marketing/lore pages. Best practice: it now CAPTURES the
// email in place (InlineCapture) instead of bouncing the visitor to a
// separate page — every extra click sheds signups. A secondary link to
// the full /kickstarter pitch remains for those who want the detail.
// Inline styles + inherited text color so it adapts to light or dark
// page backgrounds. `source` attributes the signup per surface in the CRM
// and Kit; defaults to the kickstarter tag so every existing usage keeps
// a valid attribution without changes.

import InlineCapture from './InlineCapture';

export default function KickstarterCTA({ source }: { source?: string }) {
  return (
    <div
      className="ks-funnel-cta"
      style={{
        textAlign: 'center',
        padding: '32px 20px',
        borderTop: '1px solid rgba(194, 164, 107, 0.3)',
      }}
    >
      <p style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 600 }}>
        Thresan: Skyflag comes to Kickstarter on October 20, 2026. Be first to know —
        and get early-backer pricing.
      </p>
      <InlineCapture source={source} />
      <p style={{ margin: '14px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
        Prefer the full story?{' '}
        <a href="/kickstarter" style={{ color: '#c2a46b' }}>
          See the Kickstarter page →
        </a>
      </p>
    </div>
  );
}
