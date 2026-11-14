import { ApiError } from './api/client'
import { t } from './i18n'

/** Admins get "message: technical reason" from the backend; it goes to the console, never onto the page. */
export function logReason(e: ApiError) {
  if (e.detail.includes(': ')) console.warn('AI error:', e.detail)
}

/** A friendly message for a failed AI request. */
export function aiErrorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return t('Ліміт запитів до ШІ на сьогодні вичерпано. Спробуйте завтра')
    if (e.status === 503) return t('ШІ ще не налаштований на сервері')
    if (e.status === 502 && e.detail.startsWith('AI is busy')) {
      logReason(e)
      return t('ШІ зараз перевантажений. Спробуйте за кілька хвилин, цей запит не списано з ліміту.')
    }
    if (e.status === 502) {
      logReason(e)
      return t('ШІ не зміг відповісти. Спробуйте ще раз або інше фото.')
    }
  }
  return t('Щось пішло не так. Спробуйте ще раз')
}
