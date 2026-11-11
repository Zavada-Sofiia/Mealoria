import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const buildId = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.VITE_RELEASE ?? String(Date.now())

/** Puts the build id into sw.js: a changed file makes browsers install the new worker. */
function stampServiceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js')
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', buildId))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  define: {
    // lets error reports name the version; Cloudflare Workers Builds exposes the commit
    'import.meta.env.VITE_RELEASE': JSON.stringify(
      process.env.VITE_RELEASE ?? process.env.WORKERS_CI_COMMIT_SHA ?? '',
    ),
  },
})
