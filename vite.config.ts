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
})
