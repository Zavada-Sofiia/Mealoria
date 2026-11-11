import { createContext, useContext } from 'react'

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
  return iso ? new Date(iso).toLocaleDateString('uk-UA', { dateStyle: 'long' }) : ''
}

export function limitLines(l: Limits, premium: boolean): string[] {
  return [
    `До ${l.dishes} власних страв`,
    `${l.ai_per_day} ${premium ? 'запитів' : 'запити'} до ШІ-помічника щодня`,
    premium
      ? 'Планування в календарі на рік уперед'
      : `Планування в календарі на ${l.plan_days_ahead} днів уперед`,
    ...(l.photos_per_day > 0 ? [`До ${l.photos_per_day} ШІ-фото власних страв щодня`] : []),
  ]
}
