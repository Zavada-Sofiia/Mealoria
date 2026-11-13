import type { AuthError } from '@supabase/supabase-js'
import { t } from './i18n'

const EXPIRED_LINK = () => t('Посилання недійсне або застаріло. Запросіть нове.')
const SESSION_ENDED = () => t('Сесія завершилась. Увійдіть знову.')
const TOO_MANY = () => t('Забагато спроб. Зачекайте кілька хвилин і спробуйте знову.')

/** Supabase answers in English; this turns its error code into our own text in the chosen language. */
export function authErrorText(error: Pick<AuthError, 'code' | 'status' | 'name' | 'message'>): string {
  const offline = error.name === 'AuthRetryableFetchError' || /failed to fetch|network|load failed/i.test(error.message)
  if (offline && !error.code) return t('Немає з’єднання з інтернетом. Перевірте мережу й спробуйте ще раз.')
  switch (error.code) {
    case 'invalid_credentials':
      return t('Неправильний email або пароль. Перевірте дані й спробуйте ще раз.')
    case 'email_not_confirmed':
      return t('Email ще не підтверджено. Відкрийте лист від нас і натисніть на посилання (зазирніть у «Спам»).')
    case 'user_already_exists':
    case 'email_exists':
      return t('Акаунт із таким email уже є. Увійдіть або натисніть «Забули пароль?».')
    case 'weak_password':
      return t('Пароль занадто слабкий. Придумайте інший.')
    case 'same_password':
      return t('Новий пароль має відрізнятися від попереднього.')
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return TOO_MANY()
    case 'email_address_invalid':
    case 'validation_failed':
      return t('Перевірте, чи правильно введено email.')
    case 'user_banned':
      return t('Цей акаунт заблоковано. Напишіть нам на сторінці «Допомога».')
    case 'signup_disabled':
    case 'email_provider_disabled':
      return t('Реєстрацію тимчасово вимкнено. Спробуйте пізніше.')
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return EXPIRED_LINK()
    case 'session_expired':
    case 'session_not_found':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
    case 'no_authorization':
    case 'bad_jwt':
    case 'reauthentication_needed':
      return SESSION_ENDED()
    case 'provider_disabled':
    case 'oauth_provider_not_supported':
      return t('Вхід через Google тимчасово недоступний. Увійдіть за email і паролем.')
  }
  if (error.status === 429) return TOO_MANY()
  return t('Не вдалося виконати дію. Спробуйте ще раз пізніше.')
}

/** Supabase sends a failed e-mail link or Google sign-in back to the site with the reason in the address. */
export function authLinkError(): string {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const code = params.get('error_code') ?? query.get('error_code')
  const error = params.get('error') ?? query.get('error')
  if (!code && !error) return ''
  if (code === 'otp_expired') return EXPIRED_LINK()
  if (error === 'access_denied' && !code) return t('Вхід через Google скасовано.')
  return t('Не вдалося виконати вхід. Спробуйте ще раз.')
}

export function clearAuthLinkError() {
  if (/error/.test(window.location.hash + window.location.search)) {
    window.history.replaceState(null, '', window.location.pathname)
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
