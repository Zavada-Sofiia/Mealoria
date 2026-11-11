import { t } from './i18n'

const MEAL_NAMES: Record<number, string[]> = {
  1: ['Їжа'],
  2: ['Сніданок', 'Вечеря'],
  3: ['Сніданок', 'Обід', 'Вечеря'],
  4: ['Сніданок', 'Обід', 'Перекус', 'Вечеря'],
  5: ['Сніданок', 'Перекус', 'Обід', 'Перекус', 'Вечеря'],
}

export const mealName = (count: number, slot: number) =>
  t(MEAL_NAMES[count]?.[slot] ?? 'Прийом {n}', { n: slot + 1 })

/** The dish category ("сніданок", …) that fits a calendar slot, or null when the slot has no clear meal type. */
export const slotCategory = (count: number, slot: number): string | null => {
  const name = MEAL_NAMES[count]?.[slot]
  return name && name !== 'Їжа' ? name.toLowerCase() : null
}
