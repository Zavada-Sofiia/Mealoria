import { useEffect, useState, type FormEvent } from 'react'
import StatusLine from '../components/StatusLine'
import { apiFetch } from '../api/client'
import { supabase } from '../api/supabase'
import SectionRail from '../components/SectionRail'
import { Link } from 'react-router-dom'
import { usePlan } from '../plan/context'
import { oneStepPerLine } from '../steps'
import { aiErrorText as errorText } from '../aiError'
import { kcalMacros as macros } from '../macros'
import { t } from '../i18n'
import { convertAmount } from '../units'

type Ingredient = { name: string; amount: string }
type Idea = {
  name: string
  category: string
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  fiber_g?: number
  cook_minutes: number
  ingredients: Ingredient[]
  recipe: string
  missing?: string[]
}
type Quota = { used: number; limit: number }

const CATEGORIES = ['сніданок', 'обід', 'вечеря', 'перекус']
// the AI answers in the language of the interface
const ENGLISH_CATEGORIES: Record<string, string> = { breakfast: 'сніданок', lunch: 'обід', dinner: 'вечеря', snack: 'перекус' }
const toCategory = (c: string) => ENGLISH_CATEGORIES[c.toLowerCase()] ?? c.toLowerCase()
const json = { 'Content-Type': 'application/json' }

// Results stay in this browser (per account) until cleared, so leaving the page does not lose them.
type Saved = {
  category: string
  note: string
  ideas: Idea[]
  fridge: string
  fridgeStrict: boolean
  fridgeIdeas: Idea[]
}
const EMPTY_SAVED: Saved = { category: '', note: '', ideas: [], fridge: '', fridgeStrict: false, fridgeIdeas: [] }
const storageKey = (userId: string) => `mealoria.ai.v1.${userId}`

function loadSaved(userId: string): Saved {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? { ...EMPTY_SAVED, ...JSON.parse(raw) } : EMPTY_SAVED
  } catch {
    return EMPTY_SAVED
  }
}

const RAIL = [
  { id: 'ai-recipes', label: 'Підбір' },
  { id: 'ai-fridge', label: 'З холодильника' },
]

function IdeaList({ ideas, saved, onSave }: { ideas: Idea[]; saved: string[]; onSave: (i: Idea) => void }) {
  return (
    <ul className="cards" style={{ marginTop: 16 }}>
      {ideas.map((i) => (
        <li key={i.name}>
          <strong>{i.name}</strong> · {t(i.category)} · {t('{n} хв', { n: i.cook_minutes })}
          <div className="muted">{macros(i)}</div>
          {i.missing && i.missing.length > 0 && (
            <div className="muted">{t('Докупити: {list}', { list: i.missing.join(', ') })}</div>
          )}
          <details>
            <summary>{t('Рецепт')}</summary>
            <div>{i.ingredients.map((x) => `${x.name} (${convertAmount(x.amount)})`).join(', ')}</div>
            <p style={{ whiteSpace: 'pre-line' }}>{oneStepPerLine(i.recipe)}</p>
          </details>
          <div className="actions" style={{ marginTop: 8 }}>
            <button onClick={() => onSave(i)} disabled={saved.includes(i.name)}>
              {saved.includes(i.name) ? t('Додано ✓') : t('У мої страви')}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function AI() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? ''))
  }, [])

  if (userId === null) return null
  return <AIPage key={userId} userId={userId} />
}

function AIPage({ userId }: { userId: string }) {
  const { me, table } = usePlan()
  const [saved] = useState(() => (userId ? loadSaved(userId) : EMPTY_SAVED))
  const [quota, setQuota] = useState<Quota | null>(null)
  const [category, setCategory] = useState(saved.category)
  const [note, setNote] = useState(saved.note)
  const [ideas, setIdeas] = useState<Idea[]>(saved.ideas)
  const [fridge, setFridge] = useState(saved.fridge)
  const [fridgeStrict, setFridgeStrict] = useState(saved.fridgeStrict)
  const [fridgeIdeas, setFridgeIdeas] = useState<Idea[]>(saved.fridgeIdeas)
  const [busy, setBusy] = useState<'ideas' | 'fridge' | null>(null)
  const [savedNames, setSavedNames] = useState<string[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!userId) return
    try {
      localStorage.setItem(
        storageKey(userId),
        JSON.stringify({ category, note, ideas, fridge, fridgeStrict, fridgeIdeas }),
      )
    } catch {
      // storage full or blocked: the results just will not survive leaving the page
    }
  }, [userId, category, note, ideas, fridge, fridgeStrict, fridgeIdeas])

  useEffect(() => {
    apiFetch<Quota>('/api/ai/quota')
      .then(setQuota)
      .catch(() => setStatus(t('Не вдалося перевірити ліміт ШІ')))
  }, [])

  async function refreshQuota() {
    apiFetch<Quota>('/api/ai/quota').then(setQuota).catch(() => {})
  }

  async function suggest(e: FormEvent) {
    e.preventDefault()
    setBusy('ideas')
    setStatus('')
    try {
      const r = await apiFetch<{ recipes: Idea[] }>('/api/ai/recipes', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ category: category || null, note }),
      })
      setIdeas(r.recipes)
    } catch (err) {
      setStatus(errorText(err))
    } finally {
      setBusy(null)
      void refreshQuota()
    }
  }

  const fridgeProducts = () =>
    [...new Set(fridge.split(/[,;\n]+/).map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean))]

  async function loadPantry() {
    try {
      const rows = await apiFetch<{ name: string }[]>('/api/shopping/pantry')
      if (!rows.length) return setStatus(t('У «Вже є вдома» ще нічого немає'))
      setFridge([...new Set([...fridgeProducts(), ...rows.map((r) => r.name)])].join(', '))
      setStatus('')
    } catch {
      setStatus(t('Не вдалося завантажити «Вже є вдома»'))
    }
  }

  async function suggestFromFridge(e: FormEvent) {
    e.preventDefault()
    const products = fridgeProducts()
    if (!products.length) return setStatus(t('Додайте хоча б один продукт'))
    setBusy('fridge')
    setStatus('')
    try {
      const r = await apiFetch<{ recipes: Idea[] }>('/api/ai/fridge-recipes', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ ingredients: products, strict: fridgeStrict }),
      })
      setFridgeIdeas(r.recipes)
    } catch (err) {
      setStatus(errorText(err))
    } finally {
      setBusy(null)
      void refreshQuota()
    }
  }

  async function saveIdea(i: Idea) {
    if (savedNames.includes(i.name)) return
    setSavedNames((n) => [...n, i.name])
    try {
      await apiFetch('/api/dishes', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          name: i.name,
          categories: CATEGORIES.includes(toCategory(i.category)) ? [toCategory(i.category)] : [],
          recipe: i.recipe,
          ingredients: i.ingredients,
          calories: i.calories,
          protein_g: i.protein_g,
          fat_g: i.fat_g,
          carbs_g: i.carbs_g,
          fiber_g: i.fiber_g || null,
        }),
      })
      setStatus(t('«{name}» додано до моїх страв', { name: i.name }))
    } catch {
      setSavedNames((n) => n.filter((x) => x !== i.name))
      setStatus(t('Не вдалося зберегти страву'))
    }
  }

  const left = quota ? Math.max(0, quota.limit - quota.used) : null
  const hasResults = ideas.length > 0 || fridgeIdeas.length > 0

  function clearResults() {
    setIdeas([])
    setFridgeIdeas([])
    setStatus('')
  }

  return (
    <div>
      <h1>
        {t('Що приготувати?')} <span className="badge paid">{t('ШІ')}</span>
      </h1>
      <p className="muted">
        {quota
          ? `${t('Сьогодні використано {used} з {limit} запитів', { used: quota.used, limit: quota.limit })}${left === 0 ? t('. Ліміт вичерпано') : ''}.`
          : t('Перевіряємо ліміт…')}{' '}
        {me?.plan === 'free' && table && (
          <>
            {t('У преміумі {n} запитів на добу.', { n: table.premium.ai_per_day })} <Link to="/pricing">{t('Тарифи')}</Link>
          </>
        )}
      </p>
      <StatusLine text={status} />
      {hasResults && (
        <p>
          <small className="muted">{t('Результати збережено в цьому браузері.')} </small>
          <button type="button" onClick={clearResults}>{t('Очистити результати')}</button>
        </p>
      )}

      <SectionRail items={RAIL} />

      <section className={`card${busy === 'ideas' ? ' thinking' : ''}`} id="ai-recipes">
        <h2>{t('Підібрати рецепти')}</h2>
        <p className="muted">
          {t('Ураховуємо ваш профіль: тип харчування, алергени, кухні, час, бюджет і калораж. Відповідь може займати до півхвилини.')}
        </p>
        <form onSubmit={suggest}>
          <div className="row">
            <label>
              {t('Категорія')}
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{t('Будь-яка')}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Побажання (необов'язково)")}
              <input value={note} maxLength={200} placeholder={t('Наприклад, щось із гречкою')}
                onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <button type="submit" disabled={busy !== null || left === 0}>
            {busy === 'ideas' ? t('Думаємо…') : t('Підібрати')}
          </button>
        </form>

        {ideas.length > 0 && <IdeaList ideas={ideas} saved={savedNames} onSave={saveIdea} />}
      </section>

      <section className={`card${busy === 'fridge' ? ' thinking' : ''}`} id="ai-fridge">
        <h2>{t('Рецепти з того, що є в холодильнику')}</h2>
        <p className="muted">
          {t('Напишіть продукти, які у вас є, і ШІ запропонує, що з них приготувати. Це окрема функція: звичайний підбір рецептів вище працює як і раніше.')}
        </p>
        <form onSubmit={suggestFromFridge}>
          <label>
            {t('Що є в холодильнику')}
            <textarea value={fridge} maxLength={1000} placeholder={t('яйця, молоко, сир, цибуля')}
              onChange={(e) => setFridge(e.target.value)} />
          </label>
          <p>
            <button type="button" onClick={() => void loadPantry()}>{t('Взяти з «Вже є вдома»')}</button>
          </p>
          <p>
            <label className="inline">
              <input type="checkbox" checked={fridgeStrict} onChange={(e) => setFridgeStrict(e.target.checked)} />{' '}
              {t('Лише з цих продуктів, нічого не докуповувати')}
            </label>
          </p>
          <button type="submit" disabled={busy !== null || left === 0}>
            {busy === 'fridge' ? t('Думаємо…') : t('Підібрати з холодильника')}
          </button>
        </form>
        {fridgeIdeas.length > 0 && <IdeaList ideas={fridgeIdeas} saved={savedNames} onSave={saveIdea} />}
      </section>

      <p>
        <small>
          {t('Побажання та список продуктів надсилаються в Google Gemini. На безкоштовному тарифі Google може використовувати такі дані для покращення своїх продуктів, тому не вписуйте особисту інформацію.')}
        </small>
      </p>
    </div>
  )
}
