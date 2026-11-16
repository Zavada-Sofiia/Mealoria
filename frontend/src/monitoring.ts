import { ApiError } from './api/client'

type SentryModule = typeof import('./sentryClient')

let sentry: SentryModule | null = null
// reports that come before Sentry has loaded are sent right after it loads
const early: ((s: SentryModule) => void)[] = []
const report = (send: (s: SentryModule) => void) => (sentry ? send(sentry) : early.length < 20 && early.push(send))

/** After the page has loaded and the browser is idle, so the SDK does not compete with the first screen. */
const pageIdle = () =>
  new Promise<void>((resolve) => {
    const later = () =>
      'requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout: 4000 }) : setTimeout(resolve, 1500)
    if (document.readyState === 'complete') later()
    else window.addEventListener('load', later, { once: true })
  })

/** Statuses that are normal behaviour (not signed in, plan limit, busy AI), not bugs. */
const EXPECTED = new Set([401, 403, 404, 422, 429, 502, 503])

/**
 * Start error reporting when VITE_SENTRY_DSN is set. Sentry is loaded on demand, so the main bundle
 * stays small and nothing happens at all without a DSN.
 */
export async function initMonitoring(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  // crashes while the SDK is still on its way are kept and sent once it is there
  const onError = (e: ErrorEvent) => report((s) => s.captureException(e.error ?? e.message))
  const onRejection = (e: PromiseRejectionEvent) => report((s) => s.captureException(e.reason))
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  await pageIdle()
  const module = await import('./sentryClient')
  module.init({
    dsn,
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_RELEASE as string | undefined) || undefined,
    // Privacy: no user info, cookies, headers (they carry the sign-in token), request or response
    // bodies (they can hold photos) and no URL query strings.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
    beforeSend(event, hint) {
      const error = hint.originalException
      if (error instanceof ApiError && EXPECTED.has(error.status)) return null
      return event
    },
  })
  sentry = module
  window.removeEventListener('error', onError)
  window.removeEventListener('unhandledrejection', onRejection)
  early.splice(0).forEach((send) => send(module))
}

/** Report an error that was caught by the app (the error boundary calls this). */
export function reportError(error: unknown): void {
  report((s) => s.captureException(error))
}

/** A warning that is not an exception (for example, the account was signed out without pressing «Вийти»). */
export function reportWarning(message: string, extra: Record<string, unknown> = {}): void {
  report((s) => s.captureMessage(message, { level: 'warning', extra }))
}
