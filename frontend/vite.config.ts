import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // lets error reports name the version; Cloudflare Workers Builds exposes the commit
    'import.meta.env.VITE_RELEASE': JSON.stringify(
      process.env.VITE_RELEASE ?? process.env.WORKERS_CI_COMMIT_SHA ?? '',
    ),
  },
})
