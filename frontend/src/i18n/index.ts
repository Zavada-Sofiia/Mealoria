
export type Lang = 'uk' | 'en'

const KEY = 'lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'uk' || saved === 'en') return saved
  } catch {
    // no storage: fall back to the browser language
  }
  return navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : 'en'
}

let current: Lang = detect()
if (typeof document !== 'undefined') document.documentElement.lang = current

export const getLang = () => current

// the English dictionaries are separate files, fetched only for people who use English
let en: Record<string, string> = {}
let foodEn: Record<string, string> = {}
export async function loadEnglish(): Promise<void> {
  if (Object.keys(en).length > 0) return
  const [ui, food] = await Promise.all([import('./en'), import('./foodEn')])
  en = ui.en
  foodEn = food.foodEn
}

const foodKey = (text: string) => text.trim().split(/\s+/).join(' ').toLowerCase()
// these stay capitalised in "+ greek yogurt" style lists
const PROPER = /^(Greek|Caesar|Niçoise)\b/

/**
 * A recipe name, product or recipe step from the shared catalogue, in English when the site is in English.
 * Saved copies of catalogue dishes keep the Ukrainian text, so they are translated wherever they are shown;
 * anything people write themselves has no translation and stays as it is.
 */
export function food(text: string): string {
  if (current !== 'en' || !text) return text
  const found = foodEn[foodKey(text)]
  if (!found) return text
  const lower = /^\p{Ll}/u.test(text.trim()) && !PROPER.test(found)
  return lower ? found[0].toLowerCase() + found.slice(1) : found
}

/** The Ukrainian catalogue name for a product typed in English ("eggs" → "Яйця"), so «Вже є вдома» still matches recipes. */
export function foodSource(text: string): string {
  if (current !== 'en') return text
  const wanted = foodKey(text)
  const key = Object.keys(foodEn).find((k) => foodEn[k].toLowerCase() === wanted)
  return key ?? text
}

export function setLang(lang: Lang) {
  current = lang
  document.documentElement.lang = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // the choice just lasts until the page is closed
  }
}

/** The BCP 47 locale for dates and numbers. */
export const locale = () => (current === 'uk' ? 'uk-UA' : 'en-GB')

/** Ukrainian text is the key; English is looked up in the dictionary. "{name}" placeholders are filled from vars. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const base = current === 'en' ? (en[text] ?? text) : text
  return vars ? base.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : base
}
