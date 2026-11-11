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
