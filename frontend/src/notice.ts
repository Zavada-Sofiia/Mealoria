import { API_URL } from './api/client'
import { getLang } from './i18n'

export type Notice = { active: boolean; level: 'info' | 'warning'; message_uk: string; message_en: string }

export const REFRESH_MS = 5 * 60 * 1000

/** What the site shows for a notice in the current language (the other language is the fallback). */
export const noticeText = (n: Pick<Notice, 'message_uk' | 'message_en'>) =>
  (getLang() === 'en' ? n.message_en || n.message_uk : n.message_uk || n.message_en).trim()

export async function fetchNotice(): Promise<Notice | null> {
  try {
    const r = await fetch(`${API_URL}/api/notice`)
    return r.ok ? ((await r.json()) as Notice) : null
  } catch {
    return null
  }
}
