import './SiteHeader.css';

// The one canonical brand strapline. Lives here so every site renders the
// exact same words — fixing the prior drift where thresan.io said "The math
// behind the boards." and thresan.games said "The editions of Thresan."
const CANONICAL_TAGLINE = 'Three worlds. One proof.';

type SiteHeaderProps = {
  // Small per-site role tag shown beside the wordmark (e.g. "Lab", "Studio",
  // "Editions"). This is the ONLY place each site differs — the wordmark,
  // the ™, the logo and the tagline are identical everywhere. Omit for the
  // bare brand lockup.
  role?: string;
  // Escape hatch to override the strapline; defaults to the canonical line.
  tagline?: string;
};

/**
 * Shared brand masthead for the Thresan family of sites (thresan.com,
 * .studio, .io, .games, playskyflag.com). One lockup — sigil logo +
 * THRESAN™ wordmark + optional role tag + the canonical tagline — so the
 * trademark mark and the strapline read identically across every domain.
 *
 * Self-contained: SiteHeader.css declares literal values, and the only
 * shared dependency is the global `.tagline-script` (Caveat) utility, so the
 * header renders correctly dropped into any page wrapper.
 */
export default function SiteHeader({ role, tagline = CANONICAL_TAGLINE }: SiteHeaderProps) {
  return (
    <header className="site-header">
      {/* Decorative sigil — the wordmark text already names the brand to
          assistive tech, so the logo is aria-hidden to avoid a redundant
          announcement. Intrinsic 768×768 set to reserve space (no CLS). */}
      <img
        src="/3phor-logo.png"
        alt=""
        width={768}
        height={768}
        className="site-header-sigil"
        aria-hidden="true"
      />
      {role ? <p className="site-header-role">{role}</p> : null}
      <h1 className="site-header-wordmark">
        THRESAN<span className="site-header-tm">™</span>
      </h1>
      <p className="site-header-tagline tagline-script">{tagline}</p>
    </header>
  );
}
