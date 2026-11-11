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
