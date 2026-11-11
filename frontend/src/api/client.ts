import { supabase } from './supabase'

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail = '') {
    super(`API ${status}`)
    this.status = status
    this.detail = detail
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${data.session?.access_token}`,
    },
  })
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
