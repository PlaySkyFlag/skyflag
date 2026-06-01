// KickstarterCTA — a shared, self-contained conversion band dropped near
// the footer of marketing/lore pages that otherwise had no path to the
// list. Links to the universal /kickstarter capture (resolves on every
// host). Inline styles + inherited text color so it adapts to light or
// dark page backgrounds.

export default function KickstarterCTA() {
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
        Thresan: Skyflag comes to Kickstarter this fall.
      </p>
      <a
        href="/kickstarter"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          borderRadius: 8,
          background: '#c2a46b',
          color: '#0b0e13',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        Get the launch email →
      </a>
    </div>
  );
}
