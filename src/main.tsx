import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import Landing from './Landing.tsx'

// Path-based routing: marketing landing at /, the actual game at /play.
// We don't add react-router as a dependency for this — a one-time check
// at mount is enough since navigation between landing and game is a
// hard navigation (user clicks "Play" → browser does a fresh page load
// at /play). This keeps the bundle smaller and the routing dead simple.
//
// If you ever add real client-side navigation between landing pages
// (e.g. /about, /pricing as separate routes), swap in a router then.
const path = window.location.pathname;
const isApp = path.startsWith('/play') || path.startsWith('/app');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {isApp ? <App /> : <Landing />}
    </ErrorBoundary>
  </StrictMode>,
)
