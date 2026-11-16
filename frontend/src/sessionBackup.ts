import type { Session } from '@supabase/supabase-js'
import { supabase } from './api/supabase'
import { reportWarning } from './monitoring'
import { SESSION_ENDED_KEY } from './authError'

/*
 * iPhone home-screen apps are closed by iOS in the background, and the session that Supabase keeps in
 * localStorage is sometimes not on disk yet at that moment, so the next launch shows the sign-in page.
 * The refresh token is therefore also kept in a first-party cookie, which iOS stores more reliably; when
 * the session is missing at start, it is restored from there. Signing out removes the copy.
 */
const COOKIE = 'mealoria_rt'
const DAYS = 60
let signOutExpected = false

export function rememberSession(session: Session | null): void {
  try {
    if (session?.refresh_token) {
      document.cookie = `${COOKIE}=${encodeURIComponent(session.refresh_token)}; Max-Age=${DAYS * 86400}; Path=/; Secure; SameSite=Strict`
    } else {
      document.cookie = `${COOKIE}=; Max-Age=0; Path=/; Secure; SameSite=Strict`
    }
  } catch {
    // cookies blocked: the normal session storage still works
  }
}

function savedRefreshToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** The session at start: from Supabase's own storage, or restored from the cookie copy. */
export async function startingSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    rememberSession(data.session)
    return data.session
  }
  const token = savedRefreshToken()
  if (!token) return null
  const { data: restored, error } = await supabase.auth.refreshSession({ refresh_token: token })
  if (restored.session) {
    reportWarning('Session restored from the backup cookie', { standalone: standalone() })
    return restored.session
  }
  // no connection at launch: keep the copy and try again next time
  if (error?.name === 'AuthRetryableFetchError') return null
  rememberSession(null)
  reportWarning('Session lost and the backup could not restore it', { standalone: standalone(), code: error?.code ?? error?.name })
  return null
}

/**
 * The note for the sign-in page ("the session has ended") is written before the last try with a fresh token:
 * a refused refresh signs Supabase out at once, and the sign-in page opens before the try is over.
 */
export function noteSessionEnding(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(SESSION_ENDED_KEY, '1')
    else sessionStorage.removeItem(SESSION_ENDED_KEY)
  } catch {
    // the sign-in page then opens without the explanation
  }
}

let ending = false

/** The server no longer accepts this session (expired or revoked): sign out here; the sign-in page says why. */
export function sessionEnded(): void {
  if (ending) return
  ending = true
  reportWarning('Session refused by the server', { standalone: standalone() })
  expectSignOut()
  void supabase.auth.signOut({ scope: 'local' }).finally(() => {
    ending = false
  })
}

/** Called right before a sign-out the person asked for, so it is not reported as a problem. */
export function expectSignOut(): void {
  signOutExpected = true
}

export function onSignedOut(): void {
  rememberSession(null)
  if (!signOutExpected) reportWarning('Signed out without pressing «Вийти»', { standalone: standalone() })
  signOutExpected = false
}
