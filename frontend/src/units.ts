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

/** "150 г" -> "5.3 унц." in imperial units; metric text and text without a quantity stay as they are. */
export function convertAmount(text: string): string {
  if (!isImperial() || !text) return text
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
