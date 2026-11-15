import { getLang, t } from './i18n'

export type Units = 'metric' | 'imperial'
export type Energy = 'kcal' | 'kj'
export type DateFormat = 'dmy' | 'mdy'

const KEY = 'units'

function detect(): Units {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'metric' || saved === 'imperial') return saved
  } catch {
    // no storage: metric
  }
  return 'metric'
}

let current: Units = detect()

export const getUnits = () => current
export const isImperial = () => current === 'imperial'

export function setUnits(units: Units) {
  current = units
  try {
    localStorage.setItem(KEY, units)
  } catch {
    // the choice just lasts until the page is closed
  }
}

const KG_TO_LB = 2.2046226218
const CM_TO_IN = 0.3937007874
const G_TO_OZ = 0.0352739619
const ML_TO_FLOZ = 0.0338140227

const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits

/** Number for the screen: a decimal comma in Ukrainian, a point in English. */
export function num(n: number, digits = 1): string {
  const text = String(round(n, digits))
  return getLang() === 'en' ? text : text.replace('.', ',')
}

// body weight: stored in kg
export const weightUnit = () => (isImperial() ? t('фунтів') : t('кг'))
export const showWeight = (kg: number) => (isImperial() ? round(kg * KG_TO_LB) : round(kg))
export const storeWeight = (shown: number) => (isImperial() ? round(shown / KG_TO_LB) : shown)

// height: stored in cm, shown in inches
export const heightUnit = () => (isImperial() ? t('дюймів') : t('см'))
export const showHeight = (cm: number) => (isImperial() ? Math.round(cm * CM_TO_IN) : Math.round(cm))
export const storeHeight = (shown: number) => (isImperial() ? Math.round(shown / CM_TO_IN) : shown)

/** "5 ft 6 in" next to a height in inches. */
export function feetInches(cm: number): string {
  const total = Math.round(cm * CM_TO_IN)
  return `${Math.floor(total / 12)} ${t('фт')} ${total % 12} ${t('дюйм.')}`
}

// grams of a food (calculator): stored in g
export const gramUnit = () => (isImperial() ? t('унц.') : t('г'))
export const showGrams = (g: number) => (isImperial() ? round(g * G_TO_OZ) : g)
export const storeGrams = (shown: number) => (isImperial() ? round(shown / G_TO_OZ, 0) : shown)

const AMOUNT = /(\d+(?:[.,]\d+)?)\s*(кг|г|мл|л|kg|g|ml|l)(?![A-Za-zА-Яа-яІіЇїЄєҐґ])/gi

/** An ingredient amount for the screen: "150 г" -> "5.3 унц." in imperial units, unit words in English on the English site. */
export function convertAmount(text: string): string {
  if (!text) return text
  return amountWords(isImperial() ? toImperial(text) : text)
}

const L = 'A-Za-zА-Яа-яІіЇїЄєҐґ'
// Ukrainian units of the catalogue and of saved dishes, with the English singular and plural
const word = (stem: string) => new RegExp(`(?<![${L}])${stem}(?![${L}])`, 'g')
// spoons go before "л" (litre), which they end with
const UNIT_WORDS: [RegExp, string, string][] = [
  [word('ст\\.\\s?л\\.?'), 'tbsp', 'tbsp'],
  [word('ч\\.\\s?л\\.?'), 'tsp', 'tsp'],
  [word('кг'), 'kg', 'kg'],
  [word('г'), 'g', 'g'],
  [word('мл'), 'ml', 'ml'],
  [word('л'), 'l', 'l'],
  [word('шт\\.?'), 'pc', 'pcs'],
  [word('зубч(?:ик|ики|иків)'), 'clove', 'cloves'],
  [word('скиб(?:ка|ки|ок)'), 'slice', 'slices'],
  [word('склян(?:ка|ки|ок)'), 'cup', 'cups'],
  [word('пуч(?:ок|ки|ків)'), 'bunch', 'bunches'],
  [word('щіп(?:ка|ки|ок)'), 'pinch', 'pinches'],
  [word('за смаком'), 'to taste', 'to taste'],
]
// without a number "щіпка" reads "a pinch"
const COUNTED = new Set(['clove', 'slice', 'cup', 'bunch', 'pinch'])

/** "2 зубчики" → "2 cloves", "щіпка" → "a pinch" when the site is in English; numbers stay as they are. */
export function amountWords(text: string): string {
  if (getLang() !== 'en' || !text) return text
  let out = text
  for (const [pattern, one, many] of UNIT_WORDS) {
    out = out.replace(pattern, (_word, offset: number, whole: string) => {
      const n = whole.slice(0, offset).match(/(\d+(?:[.,]\d+)?)\s*$/)?.[1]
      if (n === undefined) return COUNTED.has(one) ? `a ${one}` : one
      return Number(n.replace(',', '.')) === 1 ? one : many
    })
  }
  return out
}

function toImperial(text: string): string {
  return text.replace(AMOUNT, (_m, n: string, unit: string) => {
    const value = Number(n.replace(',', '.'))
    switch (unit.toLowerCase()) {
      case 'кг':
      case 'kg':
        return `${num(value * KG_TO_LB)} ${t('фнт')}`
      case 'г':
      case 'g': {
        const lb = value / 453.592
        return value >= 454 ? `${num(lb)} ${t('фнт')}` : `${num(value * G_TO_OZ)} ${t('унц.')}`
      }
      case 'мл':
      case 'ml':
        return `${num(value * ML_TO_FLOZ)} ${t('рід. унц.')}`
      default:
        return `${num(value * 33.814)} ${t('рід. унц.')}`
    }
  })
}

// ---------- energy: stored in kcal, shown in kcal or kJ
const KJ_PER_KCAL = 4.184

function load<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    if (saved && (allowed as readonly string[]).includes(saved)) return saved as T
  } catch {
    // no storage: the default
  }
  return fallback
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // the choice just lasts until the page is closed
  }
}

let energy: Energy = load('energy', ['kcal', 'kj'], 'kcal')
let dateFormat: DateFormat = load('dateFormat', ['dmy', 'mdy'], 'dmy')

export const getEnergy = () => energy
export const getDateFormat = () => dateFormat

export function setEnergy(value: Energy) {
  energy = value
  save('energy', value)
}

export function setDateFormat(value: DateFormat) {
  dateFormat = value
  save('dateFormat', value)
}

export const energyUnit = () => (energy === 'kj' ? t('кДж') : t('ккал'))
export const showEnergy = (kcal: number) => Math.round(energy === 'kj' ? kcal * KJ_PER_KCAL : kcal)
export const storeEnergy = (shown: number) => Math.round(energy === 'kj' ? shown / KJ_PER_KCAL : shown)

/** A volume of water: litres, or fluid ounces in the imperial system. */
export function showWater(ml: number): string {
  return isImperial() ? `${Math.round(ml * ML_TO_FLOZ)} ${t('рід. унц.')}` : `${num(ml / 1000)} ${t('л')}`
}

/** A small amount of water (a glass): millilitres, or fluid ounces in the imperial system. */
export const showMl = (ml: number) => (isImperial() ? `${num(ml * ML_TO_FLOZ)} ${t('рід. унц.')}` : `${ml} ${t('мл')}`)

/** Quick amounts for the water buttons: common glass sizes in each system. */
export const waterPresets = () => (isImperial() ? [237, 355, 473, 591] : [150, 250, 330, 500])
