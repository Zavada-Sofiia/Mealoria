import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, apiFetch } from '../api/client'
import { supabase } from '../api/supabase'
import { blobToBase64, compressImage, uploadDishPhoto } from '../api/photos'
import PhotoPicker from '../components/PhotoPicker'
import { Link } from 'react-router-dom'
import { usePlan } from '../plan/context'
import { oneStepPerLine } from '../steps'
import { t } from '../i18n'

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
type MealPhoto = {
  is_food: boolean
  name: string
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  fiber_g?: number
  ingredients: Ingredient[]
  comment: string
}
type Quota = { used: number; limit: number }

const CATEGORIES = ['сніданок', 'обід', 'вечеря', 'перекус']
// the AI answers in the language of the interface
const ENGLISH_CATEGORIES: Record<string, string> = { breakfast: 'сніданок', lunch: 'обід', dinner: 'вечеря', snack: 'перекус' }
const toCategory = (c: string) => ENGLISH_CATEGORIES[c.toLowerCase()] ?? c.toLowerCase()
const json = { 'Content-Type': 'application/json' }

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return t('Ліміт запитів до ШІ на сьогодні вичерпано. Спробуйте завтра')
    if (e.status === 503) return t('ШІ ще не налаштований на сервері')
    if (e.status === 502 && e.detail.startsWith('AI is busy')) {
      const reason = e.detail.includes(': ') ? e.detail.slice(e.detail.indexOf(': ') + 2) : ''
      return `${t('ШІ зараз перевантажений. Спробуйте за кілька хвилин, цей запит не списано з ліміту.')}${reason ? t(' Технічна причина: {reason}', { reason }) : ''}`
    }
    if (e.status === 502) {
      // admins get "message: technical reason" from the backend
      const reason = e.detail.includes(': ') ? e.detail.slice(e.detail.indexOf(': ') + 2) : ''
      return `${t('ШІ не зміг відповісти. Спробуйте ще раз або інше фото.')}${reason ? t(' Технічна причина: {reason}', { reason }) : ''}`
    }
  }
  return t('Щось пішло не так. Спробуйте ще раз')
}

function macros(x: { calories: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g?: number }) {
  const v = { kcal: x.calories, p: x.protein_g, f: x.fat_g, c: x.carbs_g }
  return x.fiber_g
    ? t('{kcal} ккал · Б {p} / Ж {f} / В {c} · Кл {k} г', { ...v, k: x.fiber_g })
    : t('{kcal} ккал · Б {p} / Ж {f} / В {c} г', v)
}

// Results stay in this browser (per account) until cleared, so leaving the page does not lose them.
type Saved = {
  category: string
  note: string
  ideas: Idea[]
  fridge: string
  fridgeStrict: boolean
  fridgeIdeas: Idea[]
  meal: MealPhoto | null
  mealPhoto: string | null // compressed photo as a data URL
}
const EMPTY_SAVED: Saved = { category: '', note: '', ideas: [], fridge: '', fridgeStrict: false, fridgeIdeas: [], meal: null, mealPhoto: null }
const storageKey = (userId: string) => `mealoria.ai.v1.${userId}`

function loadSaved(userId: string): Saved {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? { ...EMPTY_SAVED, ...JSON.parse(raw) } : EMPTY_SAVED
  } catch {
    return EMPTY_SAVED
  }
}

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
            <div>{i.ingredients.map((x) => `${x.name} (${x.amount})`).join(', ')}</div>
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
  const [meal, setMeal] = useState<MealPhoto | null>(saved.meal)
  const [mealPhoto, setMealPhoto] = useState<string | null>(saved.mealPhoto)
  const [fridge, setFridge] = useState(saved.fridge)
  const [fridgeStrict, setFridgeStrict] = useState(saved.fridgeStrict)
  const [fridgeIdeas, setFridgeIdeas] = useState<Idea[]>(saved.fridgeIdeas)
  const [busy, setBusy] = useState<'ideas' | 'fridge' | 'photo' | null>(null)
  const [savedNames, setSavedNames] = useState<string[]>([])
  const [mealSaved, setMealSaved] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!userId) return
    try {
      localStorage.setItem(
        storageKey(userId),
        JSON.stringify({ category, note, ideas, fridge, fridgeStrict, fridgeIdeas, meal, mealPhoto }),
      )
    } catch {
      // storage full or blocked: the results just will not survive leaving the page
    }
  }, [userId, category, note, ideas, fridge, fridgeStrict, fridgeIdeas, meal, mealPhoto])

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

  async function analyse(file: File | undefined) {
    if (!file) return
    setBusy('photo')
    setStatus('')
    setMeal(null)
    setMealSaved(false)
    try {
      const image_base64 = await blobToBase64(await compressImage(file))
      setMealPhoto(`data:image/jpeg;base64,${image_base64}`)
      setMeal(
        await apiFetch<MealPhoto>('/api/ai/meal-photo', {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ image_base64, mime_type: 'image/jpeg' }),
        }),
      )
    } catch (err) {
      setStatus(err instanceof ApiError ? errorText(err) : t('Не вдалося обробити фото'))
    } finally {
      setBusy(null)
      void refreshQuota()
    }
  }

  async function saveMeal() {
    if (!meal || !mealPhoto || mealSaved) return
    setMealSaved(true)
    try {
      const photo_url = await uploadDishPhoto(await (await fetch(mealPhoto)).blob())
      await apiFetch('/api/dishes', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          name: meal.name || t('Страва'),
          calories: meal.calories,
          protein_g: meal.protein_g,
          fat_g: meal.fat_g,
          carbs_g: meal.carbs_g,
          fiber_g: meal.fiber_g || null,
          ingredients: meal.ingredients,
          photo_url,
        }),
      })
      setStatus(t('«{name}» додано до моїх страв', { name: meal.name }))
      setMeal(null)
      setMealPhoto(null)
      setMealSaved(false)
    } catch {
      setMealSaved(false)
      setStatus(t('Не вдалося зберегти страву'))
    }
  }

  const left = quota ? Math.max(0, quota.limit - quota.used) : null
  const hasResults = ideas.length > 0 || fridgeIdeas.length > 0 || meal !== null

  function clearResults() {
    setIdeas([])
    setFridgeIdeas([])
    setMeal(null)
    setMealPhoto(null)
    setStatus('')
  }

  return (
    <div>
      <h1>
        {t('ШІ-помічник')} <span className="badge paid">{t('ШІ')}</span>
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
      {status && <p className="status">{status}</p>}
      {hasResults && (
        <p>
          <small className="muted">{t('Результати збережено в цьому браузері.')} </small>
          <button type="button" onClick={clearResults}>{t('Очистити результати')}</button>
        </p>
      )}

      <section className="card">
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

      <section className="card">
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

      <section className="card red">
        <h2>{t('Калорії по фото')}</h2>
        <p className="muted">{t('Сфотографуйте страву, і ШІ оцінить калорії, БЖВ та інгредієнти.')}</p>
        <PhotoPicker
          onFile={(f) => void analyse(f)}
          disabled={busy !== null || left === 0}
          busy={busy === 'photo'}
          title={t('Обрати фото страви')}
        />
        {busy === 'photo' && <p className="status" style={{ marginTop: 12 }}>{t('Аналізуємо фото…')}</p>}
        {meal && !meal.is_food && (
          <p className="status" style={{ marginTop: 12 }}>
            {t('На фото не видно їжі. Спробуйте інше.')}
          </p>
        )}
        {meal && meal.is_food && (
          <div style={{ marginTop: 16 }}>
            {mealPhoto && (
              <img src={mealPhoto} alt={t('Ваше фото')} style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
            )}
            <h3>{meal.name}</h3>
            <p>
              <strong>{macros(meal)}</strong>
            </p>
            <p className="muted">
              {meal.ingredients.map((x) => `${x.name} (${x.amount})`).join(', ')}
            </p>
            {meal.comment && <p className="muted">{meal.comment}</p>}
            <p>
              <small>{t('Це лише оцінка, реальні значення можуть відрізнятися.')}</small>
            </p>
            <button onClick={saveMeal} disabled={mealSaved}>
              {mealSaved ? t('Додано ✓') : t('Зберегти як страву')}
            </button>
          </div>
        )}
      </section>

      <p>
        <small>
          {t('Фото й побажання надсилаються в Google Gemini. На безкоштовному тарифі Google може використовувати такі дані для покращення своїх продуктів, тому не завантажуйте фото з людьми чи особисту інформацію.')}
        </small>
      </p>
    </div>
  )
}
