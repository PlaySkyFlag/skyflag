import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import Landing from './Landing.tsx'
import Story from './Story.tsx'
import { migrateLocalStorage } from './game/migrate.ts'

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

let rendered;
if (isApp) rendered = <App />;
else if (isStory) rendered = <Story />;
else rendered = <Landing />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {rendered}
    </ErrorBoundary>
  </StrictMode>,
)
