import { getLang } from '../i18n'
import { supabase } from './supabase'
import { noteSessionEnding, sessionEnded } from '../sessionBackup'

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail = '') {
    super(`API ${status}`)
    this.status = status
    this.detail = detail
  }
}

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function send(path: string, init: RequestInit, token: string | undefined): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'X-Lang': getLang(),
    },
  })
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  let res = await send(path, init, data.session?.access_token)
  if (res.status === 401 && data.session) {
    // the token may have expired a moment ago: one more try with a fresh one, otherwise the session is over
    noteSessionEnding(true)
    const { data: fresh, error } = await supabase.auth.refreshSession()
    if (fresh.session) res = await send(path, init, fresh.session.access_token)
    if (res.status === 401 && error?.name !== 'AuthRetryableFetchError') sessionEnded()
    else noteSessionEnding(false)
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      // no JSON body
    }
    if (res.status === 403 && (detail.startsWith('plan_limit:') || detail === 'premium_required')) {
      window.dispatchEvent(new CustomEvent('plan-limit', { detail }))
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
