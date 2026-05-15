// Vercel Edge Middleware — runs BEFORE static-file resolution.
//
// Solves the last gap from the SEO edge function (api/seo.ts): Vercel
// auto-serves dist/index.html at the root path `/` of every hostname
// BEFORE the rewrites in vercel.json fire. As a result, root-path
// social previews of subdomain hostnames (thresan.studio/,
// thresan.io/, thresan.games/, thresan.store/, thresan.com/,
// ashtapada.com/) get the playskyflag.com landing meta instead of
// their own. Non-root paths go through vercel.json's wildcard rewrite
// to /api/seo correctly — that's already shipped.
//
// Middleware solves this because it runs ahead of static file
// matching. We match exactly `/`, then rewrite internally to
// /api/seo. The function reads the original request URL via req.url
// and the host header to pick the right surface.
//
// Why exactly `/` and not all paths: vercel.json's wildcard already
// covers non-root SPA paths. Keeping the middleware matcher minimal
// avoids a per-request edge hop on already-working paths.

import { rewrite } from '@vercel/edge';

export const config = {
  matcher: '/',
};

export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  return rewrite(new URL('/api/seo', url.origin));
}
