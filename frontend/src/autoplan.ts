import { apiFetch } from './api/client'
import { iso } from './dates'
import { t } from './i18n'

export type AutoPlanResult<E = unknown> = {
  entries: E[]
  added: number
  saved_from_catalog: number
  unfilled: number
  limited: boolean
}

/** Fills the empty meals of the week that begins on `weekStart`, from today on. */
export const autoPlanWeek = <E = unknown>(weekStart: Date) =>
  apiFetch<AutoPlanResult<E>>(`/api/calendar/auto-plan?start=${iso(weekStart)}&since=${iso(new Date())}`, { method: 'POST' })

export function autoPlanMessage(r: AutoPlanResult<unknown>): string {
  const parts: string[] = []
  if (r.added > 0) parts.push(t('Заповнено прийомів їжі: {n}.', { n: r.added }))
  else if (r.unfilled === 0) parts.push(t('Усі прийоми їжі цього тижня вже заповнені.'))
  if (r.saved_from_catalog > 0) parts.push(t('Додали {n} страв із каталогу в «Мої страви».', { n: r.saved_from_catalog }))
  if (r.unfilled > 0) parts.push(t('Для {n} прийомів не знайшлося підходящої страви: додайте свої страви або рецепти з каталогу.', { n: r.unfilled }))
  if (r.limited) parts.push(t('Частину днів не заповнено: на вашому тарифі планувати можна лише на обмежену кількість днів уперед.'))
  return parts.join(' ')
}
