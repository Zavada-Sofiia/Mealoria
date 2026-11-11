import { ApiError } from './api/client'
import { t } from './i18n'

/** A friendly message for a failed AI request. */
export function aiErrorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return t('Ліміт запитів до ШІ на сьогодні вичерпано. Спробуйте завтра')
    if (e.status === 503) return t('ШІ ще не налаштований на сервері')
    if (e.status === 502 && e.detail.startsWith('AI is busy')) {
      const reason = e.detail.includes(': ') ? e.detail.slice(e.detail.indexOf(': ') + 2) : ''
      return `${t('ШІ зараз перевантажений. Спробуйте за кілька хвилин, цей запит не списано з ліміту.')}${reason ? t(' Технічна причина: {reason}', { reason }) : ''}`
    }
    if (e.status === 502) {
      // admins get "message: technical reason" from the backend
      const reason = e.detail.includes(': ') ? e.detail.slice(e.detail.indexOf(': ') + 2) : ''
      return `${t('ШІ не зміг відповісти. Спробуйте ще раз або інше фото.')}${reason ? t(' Технічна причина: {reason}', { reason }) : ''}`
    }
  }
  return t('Щось пішло не так. Спробуйте ще раз')
}
