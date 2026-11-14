import { BASIC_FOODS } from './basicFoods'

// A food found while typing; the values are per 100 g, like the Open Food Facts results.
export type FoodHit = {
  name: string
  kcal_100g: number
  protein_100g: number
  fat_100g: number
  carbs_100g: number
  fiber_100g: number
}

type Entry = { uk: string; en: string; v: readonly number[]; words: string[]; basic: boolean }
type UsdaRow = [string, string, number, number, number, number, number]

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’ʼ`]/g, "'")
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}%' ]+/gu, ' ')
    .trim()

const wordsOf = (...parts: string[]) => norm(parts.join(' ')).split(/\s+/).filter(Boolean)

const entries: Entry[] = BASIC_FOODS.map(([uk, en, kcal, p, f, c, fib, also]) => ({
  uk,
  en,
  v: [kcal, p, f, c, fib],
  words: wordsOf(uk, en, also),
  basic: true,
}))
let usdaLoaded: Promise<void> | null = null

/** The bigger table (USDA FoodData Central, about a thousand products) is loaded on first use. */
export function loadAllFoods(): Promise<void> {
  usdaLoaded ??= import('./data/usdaFoods.json').then((m) => {
    for (const [uk, en, kcal, p, f, c, fib] of m.default as UsdaRow[]) {
      entries.push({ uk, en, v: [kcal, p, f, c, fib], words: wordsOf(uk, en), basic: false })
    }
  })
  return usdaLoaded
}

/** One typo is forgiven in words of four letters or more ("гречкка", "моркав"). */
function closeEnough(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** How well one typed word fits a word of the name; Ukrainian endings change, so the stem is enough. */
function fit(t: string, w: string): number {
  if (w === t) return 4
  if (w.startsWith(t)) return 3
  if (t.length >= 4 && w.startsWith(t.slice(0, -1))) return 2.5
  if (t.length >= 5 && w.startsWith(t.slice(0, -2))) return 2.2
  if (t.length >= 6 && w.startsWith(t.slice(0, -3))) return 2 // "свинина" finds "свиняча"
  if (t.length >= 4 && closeEnough(t, w.slice(0, t.length))) return 0.6
  return 0
}

export function searchFoods(query: string, lang: 'uk' | 'en', limit = 12): FoodHit[] {
  const q = norm(query)
  const tokens = q.split(/\s+/).filter((t) => t.length > 0)
  if (q.length < 2 || tokens.length === 0) return []
  const scored: { e: Entry; score: number }[] = []
  for (const e of entries) {
    let score = 0
    let ok = true
    for (const t of tokens) {
      let best = 0
      for (const w of e.words) best = Math.max(best, fit(t, w))
      if (best === 0) {
        ok = false
        break
      }
      score += best
    }
    if (!ok) continue
    const name = norm(lang === 'en' ? e.en : e.uk)
    if (name === q) score += 6
    else if (name.startsWith(q)) score += 3
    if (e.basic) score += 1.5
    scored.push({ e, score })
  }
  scored.sort((a, b) => b.score - a.score || a.e.uk.length - b.e.uk.length)
  // a stem or a typo alone is not enough when much better matches exist ("вареники" is not "рис варений")
  const floor = (scored[0]?.score ?? 0) * 0.35
  const seen = new Set<string>()
  const hits: FoodHit[] = []
  for (const { e, score } of scored) {
    if (score < floor) break
    const name = lang === 'en' ? e.en : e.uk
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const [kcal, p, f, c, fib] = e.v
    hits.push({ name, kcal_100g: kcal, protein_100g: p, fat_100g: f, carbs_100g: c, fiber_100g: fib })
    if (hits.length >= limit) break
  }
  return hits
}
