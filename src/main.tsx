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
const App = lazyWithRetry(() => import('./App.tsx'))
const AshtapadaSplash = lazyWithRetry(() => import('./AshtapadaSplash.tsx'))
const Landing = lazyWithRetry(() => import('./Landing.tsx'))
const Review = lazyWithRetry(() => import('./Review.tsx'))
const Story = lazyWithRetry(() => import('./Story.tsx'))
const Watch = lazyWithRetry(() => import('./Watch.tsx'))

// Run the one-shot rebrand storage migration before anything else reads
// from localStorage. Idempotent — safe to call on every boot.
migrateLocalStorage();

// Path-based routing without react-router. One-time check at mount —
// hard navigation between pages (full page load) keeps the bundle
// smaller and the routing dead simple. Add a router if separate
// landing pages need client-side transitions.
const path = window.location.pathname;
const isApp = path.startsWith('/play') || path.startsWith('/app');
const isStory = path.startsWith('/story');
const isWatch = path.startsWith('/watch');
const isReview = path.startsWith('/review');
const isAshtapada = path.startsWith('/ashtapada');

let rendered;
if (isReview) rendered = <Review />;
else if (isWatch) rendered = <Watch />;
else if (isApp) rendered = <App />;
else if (isStory) rendered = <Story />;
else if (isAshtapada) rendered = <AshtapadaSplash />;
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
