// Shared helper for per-surface meta overrides. Each hostname-branched
// page (thresan.com, thresan.studio, etc.) and each path-routed page
// (/press, /origins, /story) calls applySurfaceMeta in a useEffect to
// swap the global index.html defaults for surface-specific title /
// description / og:* / twitter:* / canonical values, then restores on
// unmount.
//
// Why this matters: without per-surface overrides, every share preview
// from every surface looks identical to the Landing card. Worse, three
// distinct TLDs (thresan.com / .store / .studio / .io + ashtapada.com)
// reading as "duplicate content" without canonicals confuses search
// indexers about which URL to rank.

export type SurfaceMeta = {
  /** Sets <title>, og:title, twitter:title. Keep ≤60 chars. */
  title: string;
  /** Sets meta description, og:description, twitter:description. 140–160 chars sweet spot. */
  description: string;
  /** Sets <link rel="canonical">, og:url. Absolute URL, no trailing fragment. */
  canonicalUrl: string;
  /** Absolute URL to an og:image. Falls through to the global default if omitted. */
  ogImage?: string;
  /** Optional alt text for the og:image override. */
  ogImageAlt?: string;
};

function getMeta(sel: string): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>(sel);
}

function getLink(sel: string): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>(sel);
}

function setMetaContent(sel: string, value: string | undefined): void {
  if (value === undefined) return;
  const el = getMeta(sel);
  if (el) el.content = value;
}

function setLinkHref(sel: string, value: string | undefined): void {
  if (value === undefined) return;
  const el = getLink(sel);
  if (el) el.href = value;
}

/**
 * Override the global meta tags from index.html for a specific surface.
 * Returns a teardown that restores the previous values, call it from
 * the useEffect cleanup so SPA navigation away from the surface
 * (currently rare since main.tsx uses hard nav, but cheap insurance)
 * doesn't leak this surface's values into the next render.
 *
 * Example:
 *   useEffect(() => applySurfaceMeta({
 *     title: 'Page title',
 *     description: 'Page description.',
 *     canonicalUrl: 'https://example.com/path',
 *   }), []);
 */
export function applySurfaceMeta(m: SurfaceMeta): () => void {
  const prev = {
    title: document.title,
    description: getMeta('meta[name="description"]')?.content,
    ogTitle: getMeta('meta[property="og:title"]')?.content,
    ogDescription: getMeta('meta[property="og:description"]')?.content,
    ogUrl: getMeta('meta[property="og:url"]')?.content,
    ogImage: getMeta('meta[property="og:image"]')?.content,
    ogImageAlt: getMeta('meta[property="og:image:alt"]')?.content,
    twTitle: getMeta('meta[name="twitter:title"]')?.content,
    twDescription: getMeta('meta[name="twitter:description"]')?.content,
    twImage: getMeta('meta[name="twitter:image"]')?.content,
    canonical: getLink('link[rel="canonical"]')?.href,
  };

  document.title = m.title;
  setMetaContent('meta[name="description"]', m.description);
  setMetaContent('meta[property="og:title"]', m.title);
  setMetaContent('meta[property="og:description"]', m.description);
  setMetaContent('meta[property="og:url"]', m.canonicalUrl);
  setMetaContent('meta[property="og:image"]', m.ogImage);
  setMetaContent('meta[property="og:image:alt"]', m.ogImageAlt);
  setMetaContent('meta[name="twitter:title"]', m.title);
  setMetaContent('meta[name="twitter:description"]', m.description);
  setMetaContent('meta[name="twitter:image"]', m.ogImage);
  setLinkHref('link[rel="canonical"]', m.canonicalUrl);

  return () => {
    document.title = prev.title;
    setMetaContent('meta[name="description"]', prev.description);
    setMetaContent('meta[property="og:title"]', prev.ogTitle);
    setMetaContent('meta[property="og:description"]', prev.ogDescription);
    setMetaContent('meta[property="og:url"]', prev.ogUrl);
    setMetaContent('meta[property="og:image"]', prev.ogImage);
    setMetaContent('meta[property="og:image:alt"]', prev.ogImageAlt);
    setMetaContent('meta[name="twitter:title"]', prev.twTitle);
    setMetaContent('meta[name="twitter:description"]', prev.twDescription);
    setMetaContent('meta[name="twitter:image"]', prev.twImage);
    setLinkHref('link[rel="canonical"]', prev.canonical);
  };
}
