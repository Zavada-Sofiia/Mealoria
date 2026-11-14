import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { initMonitoring } from './monitoring.ts'
import { registerServiceWorker } from './pwa.ts'
import App from './App.tsx'
import { initEffects } from './effects.ts'
import { getLang, loadEnglish } from './i18n'

// "mealoria.mealoria.workers.dev." (with a final dot) is a different site for the browser: its own
// sign-in, and the server refuses its requests. Send such visits to the normal address.
if (location.hostname.endsWith('.')) {
  location.replace(`${location.protocol}//${location.hostname.replace(/\.+$/, '')}${location.port ? `:${location.port}` : ''}${location.pathname}${location.search}${location.hash}`)
}

void initMonitoring()

registerServiceWorker()
initEffects()

async function start() {
  // English text has to be there before any page asks for it
  if (getLang() === 'en') await loadEnglish().catch(() => {})
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
void start()
