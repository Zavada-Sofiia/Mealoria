import { t } from './i18n'
import { energyUnit, showEnergy } from './units'

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
  const v = { kcal: showEnergy(x.calories), unit: energyUnit(), p: x.protein_g, f: x.fat_g, c: x.carbs_g }
  return x.fiber_g
    ? t('{kcal} {unit} · Б {p} / Ж {f} / В {c} · Кл {k} г', { ...v, k: x.fiber_g })
    : t('{kcal} {unit} · Б {p} / Ж {f} / В {c} г', v)
}

/** "Б 54 / 74 · Ж 38 / 63 · В 120 / 255 · Кл 14 / 26 г": what was eaten against the daily target. */
export function macrosVsTargets(
  eaten: { protein_g: number; fat_g: number; carbs_g: number; fiber_g?: number },
  target: { protein_g: number; fat_g: number; carbs_g: number; fiber_g: number },
): string {
  return t('Б {p} / {tp} · Ж {f} / {tf} · В {c} / {tc} · Кл {k} / {tk} г', {
    p: eaten.protein_g,
    tp: target.protein_g,
    f: eaten.fat_g,
    tf: target.fat_g,
    c: eaten.carbs_g,
    tc: target.carbs_g,
    k: eaten.fiber_g ?? 0,
    tk: target.fiber_g,
  })
}
