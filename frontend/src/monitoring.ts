import { ApiError } from './api/client'

type SentryModule = typeof import('@sentry/react')

let sentry: SentryModule | null = null

/** Statuses that are normal behaviour (not signed in, plan limit, busy AI), not bugs. */
const EXPECTED = new Set([401, 403, 404, 422, 429, 502, 503])

/**
 * Start error reporting when VITE_SENTRY_DSN is set. Sentry is loaded on demand, so the main bundle
 * stays small and nothing happens at all without a DSN.
 */
export async function initMonitoring(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  const module = await import('@sentry/react')
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
}

/** Report an error that was caught by the app (the error boundary calls this). */
export function reportError(error: unknown): void {
  sentry?.captureException(error)
}

/** A warning that is not an exception (for example, the account was signed out without pressing «Вийти»). */
export function reportWarning(message: string, extra: Record<string, unknown> = {}): void {
  sentry?.captureMessage(message, { level: 'warning', extra })
}
