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

let rendered;
if (isWatch) rendered = <Watch />;
else if (isApp) rendered = <App />;
else if (isStory) rendered = <Story />;
else rendered = <Landing />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="route-loading">Loading…</div>}>
        {rendered}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
