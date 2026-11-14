import { createContext, useContext } from 'react'
import { locale, t } from '../i18n'

export type Limits = {
  dishes: number
  ai_per_day: number
  plan_days_ahead: number
  photos_per_day: number
}
export type PlanTable = { free: Limits; premium: Limits }
export type MyPlan = Limits & {
  plan: 'free' | 'premium'
  premium_until: string | null
  dishes_used: number
}

export type PlanValue = { me: MyPlan | null; table: PlanTable | null; refresh: () => void }

export const PlanContext = createContext<PlanValue>({ me: null, table: null, refresh: () => {} })

export const usePlan = () => useContext(PlanContext)

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(locale(), { dateStyle: 'long' }) : ''
}

export function limitLines(l: Limits, premium: boolean): string[] {
  return [
    t('До {n} власних страв', { n: l.dishes }),
    t(premium ? '{n} запитів до ШІ щодня' : '{n} запити до ШІ щодня', { n: l.ai_per_day }),
    premium
      ? t('Планування в календарі на рік уперед')
      : t('Планування в календарі на {n} днів уперед', { n: l.plan_days_ahead }),
    ...(l.photos_per_day > 0 ? [t('До {n} ШІ-фото власних страв щодня', { n: l.photos_per_day })] : []),
  ]
}
