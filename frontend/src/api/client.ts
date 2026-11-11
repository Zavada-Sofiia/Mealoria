import { supabase } from './supabase'

export class ApiError extends Error {
  status: number

  constructor(status: number) {
    super(`API ${status}`)
    this.status = status
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
  if (!res.ok) throw new ApiError(res.status)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
