// Vercel Edge Function — injects per-hostname OG/Twitter meta and
// above-the-fold loading copy into index.html at the edge.
//
// Why this exists: every Thresan brand domain (thresan.com, .studio,
// .io, .games, .store, ashtapada.com) and every marketing path on
// playskyflag.com serves the same Vite SPA, which only hydrates after
// JS runs. Social previewers (Twitter/X, LinkedIn, Discord, iMessage,
// Slack), search-engine snippet generators, and any cache-warmer
// that doesn't run JS see "Loading Skyflag…" as the entire body and
// the playskyflag-fixed meta tags from index.html — same preview for
// every domain. This silently kneecaps every shared link.
//
// The fix runs at the edge: read the host header, decide which
// "surface" this request represents, fetch the static index.html,
// string-replace the meta tags and the loading-shell text, return
// the rewritten HTML. After hydration, the SPA's socialMeta.ts takes
// over and continues to update tags client-side as the user navigates
// — so this only matters for the FIRST byte that a non-JS client sees.
//
// Build wiring: vercel.json rewrites the SPA paths through
// /api/seo so this runs before the static asset is served. The
// rewrite's regex excludes /index.html (and any path with a dot),
// so our internal fetch to ${origin}/index.html serves the raw
// static file without a rewrite loop.

export const config = { runtime: 'edge' };

// ─── Surface metadata ───────────────────────────────────────────────

type Surface = {
  title: string;
  description: string;
  ogImage: string;          // absolute https URL
  loadingHeadline: string;  // shown in the loading-shell div before JS
  loadingTagline?: string;  // optional smaller subtitle below the headline
};

// Per-hostname surfaces. Keys do NOT include the "www." prefix —
// the resolver strips it before lookup.
const HOSTNAME_SURFACES: Record<string, Surface> = {
  'thresan.com': {
    title: 'Thresan — the rules behind the editions',
    description: 'Thresan is a chess-style abstract strategy game played across three stacked 6x6 boards. Skyflag is the current edition. Discover the universe.',
    ogImage: 'https://playskyflag.com/thresan-og-card.jpg',
    loadingHeadline: 'Thresan',
    loadingTagline: 'Three worlds. One proof.',
  },
  'thresan.studio': {
    title: 'Thresan Studio — designed by Dr. Nelson Jatel',
    description: 'The studio behind Thresan, designed in British Columbia by Dr. Nelson Jatel. Free turn-based abstract strategy played across three stacked boards.',
    ogImage: 'https://playskyflag.com/thresan-og-studio.jpg',
    loadingHeadline: 'Thresan Studio',
    loadingTagline: 'Designed in British Columbia.',
  },
  'thresan.io': {
    title: 'Thresan Lab — engine notes, opening theory, build journal',
    description: 'Engineering and theory notes for Thresan. Engine design, opening analysis, and build journal entries from the studio.',
    ogImage: 'https://playskyflag.com/thresan-og-card.jpg',
    loadingHeadline: 'Thresan Lab',
    loadingTagline: 'Engine notes. Opening theory. Build journal.',
  },
  'thresan.games': {
    title: 'Thresan Games — catalog of editions',
    description: 'Thresan editions catalog. Skyflag is the current edition; future editions share the same rules under the same umbrella brand.',
    ogImage: 'https://playskyflag.com/thresan-og-clans.jpg',
    loadingHeadline: 'Thresan Games',
    loadingTagline: 'One rule set. Many editions.',
  },
  'thresan.store': {
    title: 'Thresan Store — premium physical edition',
    description: 'Premium physical edition of Thresan: Skyflag. Matte black with gold accents, transparent acrylic boards, brass-cast pieces, weighted base. Kickstarter Q3 2026.',
    ogImage: 'https://playskyflag.com/skyflag-render-fan.jpg',
    loadingHeadline: 'Thresan Store',
    loadingTagline: 'Premium physical edition. Kickstarter Q3 2026.',
  },
  'ashtapada.com': {
    title: 'Ashtapada — the ancient root',
    description: 'Ashtapada is one of the oldest known board games, played in ancient India for thousands of years and the same 8x8 grid that carried Chaturanga west to become chess. Thresan returns to that root and takes a different fork.',
    ogImage: 'https://playskyflag.com/ashtapada-carpet-15c.jpg',
    loadingHeadline: 'Ashtapada',
    loadingTagline: 'The root of chess. The root of Thresan.',
  },
};

// Path-based surfaces on playskyflag.com (or any host not in
// HOSTNAME_SURFACES). Path-based mirrors of the Thresan subdomains
// (/thresan-store, /thresan-studio, ...) intentionally fall through
// to DEFAULT_SURFACE here so canonical URLs stay on the subdomain.
const PATH_SURFACES: Record<string, Surface> = {
  '/': {
    title: 'Thresan: Skyflag — Three worlds. One proof.',
    description: 'Thresan: a free turn-based strategy game. Three layers. Four Lifts. One Nexus. Currently in its Skyflag edition. Play now.',
    ogImage: 'https://playskyflag.com/thresan-og-card.jpg',
    loadingHeadline: 'Thresan: Skyflag',
    loadingTagline: 'Three worlds. One proof.',
  },
  '/play': {
    title: 'Play Thresan: Skyflag online — free turn-based strategy',
    description: 'Play Thresan: Skyflag in the browser. Single-player vs AI, two-player hot-seat, online multiplayer with friends, daily puzzle.',
    ogImage: 'https://playskyflag.com/thresan-og-card.jpg',
    loadingHeadline: 'Thresan: Skyflag',
    loadingTagline: 'Loading game…',
  },
  '/story': {
    title: 'The Three Seals of Kaleo — Thresan: Skyflag story',
    description: 'The narrative storybook for Thresan: Skyflag. The world of Kaleo, the Grey Ravens, the White Stags, and the Caelum Nexus.',
    ogImage: 'https://playskyflag.com/thresan-og-stack.jpg',
    loadingHeadline: 'The Three Seals of Kaleo',
    loadingTagline: 'Volume one.',
  },
  '/origins': {
    title: 'Origins — from Ashtapada to Thresan',
    description: 'Thresan descends from Ashtapada, one of the oldest known board games and the root of chess. A historical bridge from 8th-century India to a three-layer 21st-century abstract.',
    ogImage: 'https://playskyflag.com/thresan-og-card.jpg',
    loadingHeadline: 'Origins',
    loadingTagline: 'From Ashtapada to Thresan.',
  },
  '/press': {
    title: 'Thresan: Skyflag — press kit',
    description: 'Media kit for Thresan: Skyflag. Descriptions, screenshots, founder bio, contact. Free turn-based strategy on web and iOS.',
    ogImage: 'https://playskyflag.com/thresan-og-card.jpg',
    loadingHeadline: 'Press Kit',
    loadingTagline: 'Thresan: Skyflag',
  },
  '/privacy': {
    title: 'Privacy — Thresan: Skyflag',
    description: 'Privacy policy for Thresan: Skyflag and the broader Thresan ecosystem.',
    ogImage: 'https://playskyflag.com/thresan-og-card.jpg',
    loadingHeadline: 'Privacy',
    loadingTagline: 'Thresan: Skyflag',
  },
  '/terms': {
    title: 'Terms — Thresan: Skyflag',
    description: 'Terms of use for Thresan: Skyflag and the broader Thresan ecosystem.',
    ogImage: 'https://playskyflag.com/thresan-og-card.jpg',
    loadingHeadline: 'Terms',
    loadingTagline: 'Thresan: Skyflag',
  },
};

const DEFAULT_SURFACE: Surface = PATH_SURFACES['/'];

// ─── Resolver ───────────────────────────────────────────────────────

function resolveSurface(host: string, path: string): Surface {
  // Strip leading "www." for hostname matching; the redirects in
  // vercel.json already canonicalize, but bare requests may still hit
  // this function before redirect resolution depending on order.
  const hostKey = host.replace(/^www\./, '').toLowerCase();
  const hostSurface = HOSTNAME_SURFACES[hostKey];
  if (hostSurface) return hostSurface;

  // Path-based lookup. Normalize trailing slash and case.
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '').toLowerCase();
  return PATH_SURFACES[normalized] ?? DEFAULT_SURFACE;
}

// ─── HTML escaping ──────────────────────────────────────────────────

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Rewriter ───────────────────────────────────────────────────────

function injectMeta(html: string, surface: Surface, canonicalUrl: string): string {
  const titleEsc = escapeText(surface.title);
  const titleAttr = escapeAttr(surface.title);
  const descAttr = escapeAttr(surface.description);
  const ogImageAttr = escapeAttr(surface.ogImage);
  const canonicalAttr = escapeAttr(canonicalUrl);

  // Loading-shell replacement: the current static HTML has the literal
  // string "Loading Skyflag…" inside a single styled div. Replace the
  // text with the per-surface headline (and tagline if set), keeping
  // the existing wrapper styling intact.
  const loadingReplacement = surface.loadingTagline
    ? `${escapeText(surface.loadingHeadline)}<div style="margin-top:14px;font-size:0.85em;opacity:0.7;letter-spacing:0.06em;font-family:'Caveat',cursive;">${escapeText(surface.loadingTagline)}</div>`
    : escapeText(surface.loadingHeadline);

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${titleEsc}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${descAttr}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonicalAttr}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${titleAttr}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${descAttr}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonicalAttr}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${ogImageAttr}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${titleAttr}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${descAttr}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${ogImageAttr}$2`)
    .replace(/Loading Skyflag…/, loadingReplacement);
}

// ─── Handler ────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const host = (req.headers.get('host') ?? 'playskyflag.com').toLowerCase();
  const path = url.pathname;
  const surface = resolveSurface(host, path);

  // Canonical URL uses the hostname-without-www, and preserves the
  // requested path (so deep links keep their context in og:url).
  const canonicalHost = host.replace(/^www\./, '');
  const canonicalUrl = `https://${canonicalHost}${path === '/' ? '/' : path}`;

  // Fetch the static template. The build renames dist/index.html to
  // dist/_template.html post-build so Vercel doesn't auto-serve the
  // unrewritten HTML at /. The vercel.json SPA rewrite excludes paths
  // with dots, so /_template.html serves the raw static file when we
  // fetch it — no rewrite loop.
  const indexUrl = `${url.origin}/_template.html`;
  let indexResp: Response;
  try {
    indexResp = await fetch(indexUrl);
  } catch {
    // Edge fetch failure (network blip, deploy in flight, etc.). Serve
    // a minimal placeholder so the request still completes with HTML.
    // The SPA can't hydrate from this, but at least the page isn't a
    // 500 — and this branch should only fire under genuine failure.
    return new Response(
      `<!doctype html><title>${escapeText(surface.title)}</title><meta http-equiv="refresh" content="0;url=/_template.html">`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  if (!indexResp.ok) {
    return new Response(
      `<!doctype html><title>${escapeText(surface.title)}</title><meta http-equiv="refresh" content="0;url=/_template.html">`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const html = await indexResp.text();
  const rewritten = injectMeta(html, surface, canonicalUrl);

  return new Response(rewritten, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short browser cache; longer shared-CDN cache; stale-while-
      // revalidate keeps perceived latency low while a refresh runs in
      // the background. 300s at the shared edge is plenty — content
      // only changes on deploy.
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      // Vary on Host so the edge cache doesn't serve the
      // thresan.studio variant to a thresan.io request (same path,
      // different hostname surface).
      'Vary': 'Host',
    },
  });
}
