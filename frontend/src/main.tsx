import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { initMonitoring } from './monitoring.ts'
import { registerServiceWorker } from './pwa.ts'
import { initEffects } from './effects.ts'

void initMonitoring()

registerServiceWorker()
initEffects()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
