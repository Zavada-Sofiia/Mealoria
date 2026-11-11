/** Registers the service worker and reloads the page once a new release has taken over. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  const hadController = !!navigator.serviceWorker.controller
  let reloadWhenIdle = false

  const typing = () => {
    const el = document.activeElement
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return // the very first install needs no reload
    if (typing()) reloadWhenIdle = true // do not throw away what the user is typing
    else window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        const check = () => reg.update().catch(() => {})
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            if (reloadWhenIdle) window.location.reload()
          } else {
            check()
          }
        })
        setInterval(check, 30 * 60 * 1000)
      })
      .catch(() => {})
  })
}

// "Install the app" button: browsers that support it fire beforeinstallprompt, we keep the event for later
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let installEvent: InstallEvent | null = null
const installListeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e as InstallEvent
    installListeners.forEach((fn) => fn())
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    installListeners.forEach((fn) => fn())
  })
}

export const canInstall = () => installEvent !== null

export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function onInstallChange(fn: () => void) {
  installListeners.add(fn)
  return () => {
    installListeners.delete(fn)
  }
}

export async function promptInstall() {
  const event = installEvent
  if (!event) return
  await event.prompt()
  await event.userChoice
  installEvent = null
  installListeners.forEach((fn) => fn())
}
