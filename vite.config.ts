import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Best-effort git short SHA — used as the visible "version" in the footer
// so testers can paste an exact identifier when reporting an issue. Falls
// back to "dev" if git isn't available (e.g., running from a tarball).
function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

// Build-time constants — `__BUILD_TIME__` lets the running app display the
// timestamp of the current build (so testers can tell at a glance whether
// they're on the latest version after tapping "Check for updates");
// `__GIT_SHA__` lets them include an exact commit when reporting bugs.
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_SHA__: JSON.stringify(gitShortSha()),
  },
  build: {
    rollupOptions: {
      output: {
        // Force React + JSX runtime into a dedicated vendor chunk.
        // Without this, Rollup's auto-chunking was placing the JSX
        // runtime in the entry chunk while a shared `themes` chunk
        // depended on it via a top-level call. Under some load
        // orderings the export wasn't initialized in time, surfacing
        // as a hard "e is not a function" crash on production.
        // Putting React in its own vendor chunk gives every consumer
        // a fully-initialized namespace before they evaluate.
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
})
