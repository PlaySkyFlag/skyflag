import { StrictMode, Suspense, lazy, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ErrorBoundary from './ErrorBoundary.tsx'
import { migrateLocalStorage } from './game/migrate.ts'

// Stale-deploy auto-recovery for route chunks. When Vercel redeploys
// while a user has a tab open, the next route-navigation tries to
// fetch a chunk whose hash no longer exists on the CDN. Without this
// wrapper that throws "Failed to fetch" into the ErrorBoundary and
// the user sees the "Something broke" card. Instead we do a single
// reload (gated by a sessionStorage flag against reload loops); the
// fresh HTML references the current chunk hashes.
const STALE_DEPLOY_KEY = '3phor.stale-deploy-reloaded'
function looksLikeStaleChunk(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  return (
    lower.includes('failed to fetch') ||
    lower.includes('loading chunk') ||
    lower.includes('dynamically imported module') ||
    lower.includes('importing a module script') ||
    lower.includes('error loading module')
  )
}
function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory()
    } catch (err) {
      // Reload exactly once. Second-time failures fall through to
      // the ErrorBoundary so a real bug isn't masked by a loop.
      if (looksLikeStaleChunk(err) && !sessionStorage.getItem(STALE_DEPLOY_KEY)) {
        try { sessionStorage.setItem(STALE_DEPLOY_KEY, '1') } catch { /* private mode */ }
        location.reload()
        // Park the promise — reload() interrupts before it resolves.
        return new Promise<{ default: T }>(() => undefined)
      }
      throw err
    }
  })
}

// Route components are lazy-loaded so a visitor pulls down only the
// chunk for the URL they hit. Landing is the marketing surface and
// stays light; /play (App) drags in the AI worker, the board, and
// every modal — keeping that ~600kB out of the / bundle is the
// biggest single perf win available without further restructuring.
const AdminQuotes = lazyWithRetry(() => import('./AdminQuotes.tsx'))
const App = lazyWithRetry(() => import('./App.tsx'))
const AshtapadaSplash = lazyWithRetry(() => import('./AshtapadaSplash.tsx'))
const Landing = lazyWithRetry(() => import('./Landing.tsx'))
const Origins = lazyWithRetry(() => import('./Origins.tsx'))
const Press = lazyWithRetry(() => import('./Press.tsx'))
const Privacy = lazyWithRetry(() => import('./Privacy.tsx'))
const Review = lazyWithRetry(() => import('./Review.tsx'))
const Story = lazyWithRetry(() => import('./Story.tsx'))
const Terms = lazyWithRetry(() => import('./Terms.tsx'))
const ThresanGames = lazyWithRetry(() => import('./ThresanGames.tsx'))
const ThresanIO = lazyWithRetry(() => import('./ThresanIO.tsx'))
const ThresanStore = lazyWithRetry(() => import('./ThresanStore.tsx'))
const ThresanStudio = lazyWithRetry(() => import('./ThresanStudio.tsx'))
const ThresanUmbrella = lazyWithRetry(() => import('./ThresanUmbrella.tsx'))
const Watch = lazyWithRetry(() => import('./Watch.tsx'))

// Run the one-shot rebrand storage migration before anything else reads
// from localStorage. Idempotent — safe to call on every boot.
migrateLocalStorage();

// Path-based routing without react-router. One-time check at mount —
// hard navigation between pages (full page load) keeps the bundle
// smaller and the routing dead simple. Add a router if separate
// landing pages need client-side transitions.
const path = window.location.pathname;
const hostname = window.location.hostname.toLowerCase();
// ashtapada.com is a bridging domain — every URL on it should land
// on the splash, not the main game. Match explicit hostnames rather
// than endsWith so a future subdomain (staging.ashtapada.com, etc.)
// stays opt-in instead of silently inheriting the splash render.
const isAshtapadaHost =
  hostname === 'ashtapada.com' || hostname === 'www.ashtapada.com';
// thresan.store — physical edition waitlist. Every URL on this host
// lands on the store, same pattern as ashtapada.com.
const isThresanStoreHost =
  hostname === 'thresan.store' || hostname === 'www.thresan.store';
// thresan.com — universe-level brand umbrella. Short content page
// pointing visitors to the current product (Skyflag) and other
// surfaces. Vercel-level redirect for the .io defensive domain stays
// in vercel.json; thresan.com and thresan.studio no longer redirect.
const isThresanHost =
  hostname === 'thresan.com' || hostname === 'www.thresan.com';
// thresan.studio — creator surface. Short note from Nelson + outward
// CTAs. Same brand palette as thresan.com, distinct content.
const isThresanStudioHost =
  hostname === 'thresan.studio' || hostname === 'www.thresan.studio';
// thresan.io — lab / engine surface. Engine notes, opening theory,
// build journal. Same palette as the other thresan.* surfaces with
// an Aether Copper accent on the .io suffix.
const isThresanIOHost =
  hostname === 'thresan.io' || hostname === 'www.thresan.io';
// thresan.games — catalog of Thresan editions. Skyflag is the active
// entry; future editions slot in beside it. Terran Sand accent on
// the .games suffix.
const isThresanGamesHost =
  hostname === 'thresan.games' || hostname === 'www.thresan.games';
const isAdminQuotes = path.startsWith('/admin/quotes');
const isApp = path.startsWith('/play') || path.startsWith('/app');
const isStory = path.startsWith('/story');
const isWatch = path.startsWith('/watch');
const isReview = path.startsWith('/review');
const isOrigins = path.startsWith('/origins');
const isPress = path.startsWith('/press');
const isPrivacy = path.startsWith('/privacy');
const isTerms = path.startsWith('/terms');
const isAshtapadaPath = path.startsWith('/ashtapada');
const isThresanStorePath = path.startsWith('/thresan-store');
const isThresanStudioPath = path.startsWith('/thresan-studio');
const isThresanIOPath = path.startsWith('/thresan-io');
const isThresanGamesPath = path.startsWith('/thresan-games');
// /thresan path for iterating on the umbrella page from the main domain.
// Matched on exact path or trailing slash so it doesn't swallow
// /thresan-store, /thresan-studio, /thresan-io, or /thresan-games.
const isThresanPath = path === '/thresan' || path.startsWith('/thresan/');

let rendered;
if (isAshtapadaHost) rendered = <AshtapadaSplash />;
else if (isThresanStoreHost) rendered = <ThresanStore />;
else if (isThresanStudioHost) rendered = <ThresanStudio />;
else if (isThresanIOHost) rendered = <ThresanIO />;
else if (isThresanGamesHost) rendered = <ThresanGames />;
else if (isThresanHost) rendered = <ThresanUmbrella />;
else if (isAdminQuotes) rendered = <AdminQuotes />;
else if (isReview) rendered = <Review />;
else if (isWatch) rendered = <Watch />;
else if (isApp) rendered = <App />;
else if (isStory) rendered = <Story />;
else if (isOrigins) rendered = <Origins />;
else if (isPress) rendered = <Press />;
else if (isPrivacy) rendered = <Privacy />;
else if (isTerms) rendered = <Terms />;
else if (isAshtapadaPath) rendered = <AshtapadaSplash />;
else if (isThresanStorePath) rendered = <ThresanStore />;
else if (isThresanStudioPath) rendered = <ThresanStudio />;
else if (isThresanIOPath) rendered = <ThresanIO />;
else if (isThresanGamesPath) rendered = <ThresanGames />;
else if (isThresanPath) rendered = <ThresanUmbrella />;
else rendered = <Landing />;

// Mark the root so index.html's pre-mount error catcher knows
// React has taken over and shouldn't overwrite us. The attribute
// stays whether the inner render succeeds or the ErrorBoundary
// catches — both replace the static shell.
const rootEl = document.getElementById('root')!;
rootEl.setAttribute('data-react-mounted', '1');
createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="route-loading">Loading…</div>}>
        {rendered}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
