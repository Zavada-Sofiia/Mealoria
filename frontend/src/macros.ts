import { t } from './i18n'

type Grams = number | null | undefined

/** "Б 12 · Ж 8 · В 40 · Кл 5 г": protein, fat, carbs and fibre (shown when known, or always when asked). */
export function macrosLine(p: Grams, f: Grams, c: Grams, fiber?: Grams, alwaysFiber = false): string {
  const v = { p: p ?? 0, f: f ?? 0, c: c ?? 0 }
  return fiber || alwaysFiber
    ? t('Б {p} · Ж {f} · В {c} · Кл {k} г', { ...v, k: fiber ?? 0 })
    : t('Б {p} · Ж {f} · В {c} г', v)
}

/** "340 ккал · Б 12 / Ж 8 / В 40 · Кл 5 г" for an AI estimate. */
export function kcalMacros(x: { calories: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g?: number }): string {
  const v = { kcal: x.calories, p: x.protein_g, f: x.fat_g, c: x.carbs_g }
  return x.fiber_g
    ? t('{kcal} ккал · Б {p} / Ж {f} / В {c} · Кл {k} г', { ...v, k: x.fiber_g })
    : t('{kcal} ккал · Б {p} / Ж {f} / В {c} г', v)
}
