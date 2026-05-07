import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build-time constants — `__BUILD_TIME__` lets the running app display the
// timestamp of the current build (so testers can tell at a glance whether
// they're on the latest version after tapping "Check for updates").
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
