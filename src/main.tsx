import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ErrorBoundary from './ErrorBoundary.tsx'
import { migrateLocalStorage } from './game/migrate.ts'

// Route components are lazy-loaded so a visitor pulls down only the
// chunk for the URL they hit. Landing is the marketing surface and
// stays light; /play (App) drags in the AI worker, the board, and
// every modal — keeping that ~600kB out of the / bundle is the
// biggest single perf win available without further restructuring.
const App = lazy(() => import('./App.tsx'))
const Landing = lazy(() => import('./Landing.tsx'))
const Review = lazy(() => import('./Review.tsx'))
const Story = lazy(() => import('./Story.tsx'))
const Watch = lazy(() => import('./Watch.tsx'))

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

let rendered;
if (isReview) rendered = <Review />;
else if (isWatch) rendered = <Watch />;
else if (isApp) rendered = <App />;
else if (isStory) rendered = <Story />;
else rendered = <Landing />;

// Two error boundaries:
//   * OUTER — catches catastrophic errors and lazy-chunk load
//     failures. The Suspense fallback throws upward when a chunk
//     can't be fetched (network blip, stale deploy), and this
//     boundary turns that into a recoverable "Reload" overlay
//     instead of a blank page.
//   * INNER — wraps the actual route render. A crash in one
//     route's component tree (a malformed Supabase row, a worker
//     callback throwing, an SVG attribute getting NaN) is caught
//     here and doesn't take down the surrounding shell. The user
//     gets "Try again without reloading" — often enough to clear
//     a transient bad state without losing local game progress.
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
        <ErrorBoundary>
          {rendered}
        </ErrorBoundary>
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
