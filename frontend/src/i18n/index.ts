
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

// the English dictionary is a separate file, fetched only for people who use English
let en: Record<string, string> = {}
export async function loadEnglish(): Promise<void> {
  if (Object.keys(en).length === 0) en = (await import('./en')).en
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
