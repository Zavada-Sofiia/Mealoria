import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, apiFetch } from '../api/client'
import { supabase } from '../api/supabase'
import { blobToBase64, compressImage, uploadDishPhoto } from '../api/photos'
import PhotoPicker from '../components/PhotoPicker'
import { Link } from 'react-router-dom'
import { usePlan } from '../plan/context'

type Ingredient = { name: string; amount: string }
type Idea = {
  name: string
  category: string
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  cook_minutes: number
  ingredients: Ingredient[]
  recipe: string
}
type MealPhoto = {
  is_food: boolean
  name: string
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  ingredients: Ingredient[]
  comment: string
}
type Quota = { used: number; limit: number }

const CATEGORIES = ['сніданок', 'обід', 'вечеря', 'перекус']
const json = { 'Content-Type': 'application/json' }

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return 'Ліміт запитів до ШІ на сьогодні вичерпано. Спробуйте завтра'
    if (e.status === 503) return 'ШІ ще не налаштований на сервері'
    if (e.status === 502 && e.detail.startsWith('AI is busy')) {
      const reason = e.detail.includes(': ') ? e.detail.slice(e.detail.indexOf(': ') + 2) : ''
      return `ШІ зараз перевантажений. Спробуйте за кілька хвилин, цей запит не списано з ліміту.${reason ? ` Технічна причина: ${reason}` : ''}`
    }
    if (e.status === 502) {
      // admins get "message: technical reason" from the backend
      const reason = e.detail.includes(': ') ? e.detail.slice(e.detail.indexOf(': ') + 2) : ''
      return `ШІ не зміг відповісти. Спробуйте ще раз або інше фото.${reason ? ` Технічна причина: ${reason}` : ''}`
    }
  }
  return 'Щось пішло не так. Спробуйте ще раз'
}

function macros(x: { calories: number; protein_g: number; fat_g: number; carbs_g: number }) {
  return `${x.calories} ккал · Б ${x.protein_g} / Ж ${x.fat_g} / В ${x.carbs_g} г`
}

// Results stay in this browser (per account) until cleared, so leaving the page does not lose them.
type Saved = {
  category: string
  note: string
  ideas: Idea[]
  meal: MealPhoto | null
  mealPhoto: string | null // compressed photo as a data URL
}
const EMPTY_SAVED: Saved = { category: '', note: '', ideas: [], meal: null, mealPhoto: null }
const storageKey = (userId: string) => `mealoria.ai.v1.${userId}`

function loadSaved(userId: string): Saved {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? { ...EMPTY_SAVED, ...JSON.parse(raw) } : EMPTY_SAVED
  } catch {
    return EMPTY_SAVED
  }
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
  const [busy, setBusy] = useState<'ideas' | 'photo' | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!userId) return
    try {
      localStorage.setItem(
        storageKey(userId),
        JSON.stringify({ category, note, ideas, meal, mealPhoto }),
      )
    } catch {
      // storage full or blocked: the results just will not survive leaving the page
    }
  }, [userId, category, note, ideas, meal, mealPhoto])

  useEffect(() => {
    apiFetch<Quota>('/api/ai/quota')
      .then(setQuota)
      .catch(() => setStatus('Не вдалося перевірити ліміт ШІ'))
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

  async function saveIdea(i: Idea) {
    try {
      await apiFetch('/api/dishes', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          name: i.name,
          recipe: i.recipe,
          ingredients: i.ingredients,
          calories: i.calories,
          protein_g: i.protein_g,
          fat_g: i.fat_g,
          carbs_g: i.carbs_g,
        }),
      })
      setStatus(`«${i.name}» додано до моїх страв`)
    } catch {
      setStatus('Не вдалося зберегти страву')
    }
  }

  async function analyse(file: File | undefined) {
    if (!file) return
    setBusy('photo')
    setStatus('')
    setMeal(null)
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
      setStatus(err instanceof ApiError ? errorText(err) : 'Не вдалося обробити фото')
    } finally {
      setBusy(null)
      void refreshQuota()
    }
  }

  async function saveMeal() {
    if (!meal || !mealPhoto) return
    try {
      const photo_url = await uploadDishPhoto(await (await fetch(mealPhoto)).blob())
      await apiFetch('/api/dishes', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          name: meal.name || 'Страва',
          calories: meal.calories,
          protein_g: meal.protein_g,
          fat_g: meal.fat_g,
          carbs_g: meal.carbs_g,
          ingredients: meal.ingredients,
          photo_url,
        }),
      })
      setStatus(`«${meal.name}» додано до моїх страв`)
      setMeal(null)
      setMealPhoto(null)
    } catch {
      setStatus('Не вдалося зберегти страву')
    }
  }

  const left = quota ? Math.max(0, quota.limit - quota.used) : null
  const hasResults = ideas.length > 0 || meal !== null

  function clearResults() {
    setIdeas([])
    setMeal(null)
    setMealPhoto(null)
    setStatus('')
  }

  return (
    <div>
      <h1>
        ШІ-помічник <span className="badge paid">ШІ</span>
      </h1>
      <p className="muted">
        {quota
          ? `Сьогодні використано ${quota.used} з ${quota.limit} запитів${left === 0 ? '. Ліміт вичерпано' : ''}.`
          : 'Перевіряємо ліміт…'}{' '}
        {me?.plan === 'free' && table && (
          <>
            У преміумі {table.premium.ai_per_day} запитів на добу. <Link to="/pricing">Тарифи</Link>
          </>
        )}
      </p>
      {status && <p className="status">{status}</p>}
      {hasResults && (
        <p>
          <small className="muted">Результати збережено в цьому браузері. </small>
          <button type="button" onClick={clearResults}>Очистити результати</button>
        </p>
      )}

      <section className="card">
        <h2>Підібрати рецепти</h2>
        <p className="muted">
          Ураховуємо ваш профіль: тип харчування, алергени, кухні, час, бюджет і калораж. Відповідь може займати до півхвилини.
        </p>
        <form onSubmit={suggest}>
          <div className="row">
            <label>
              Категорія
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Будь-яка</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Побажання (необов'язково)
              <input value={note} maxLength={200} placeholder="Наприклад, щось із гречкою"
                onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <button type="submit" disabled={busy !== null || left === 0}>
            {busy === 'ideas' ? 'Думаємо…' : 'Підібрати'}
          </button>
        </form>

        {ideas.length > 0 && (
          <ul className="cards" style={{ marginTop: 16 }}>
            {ideas.map((i) => (
              <li key={i.name}>
                <strong>{i.name}</strong> · {i.category} · {i.cook_minutes} хв
                <div className="muted">{macros(i)}</div>
                <details>
                  <summary>Рецепт</summary>
                  <div>{i.ingredients.map((x) => `${x.name} (${x.amount})`).join(', ')}</div>
                  <p style={{ whiteSpace: 'pre-line' }}>{i.recipe}</p>
                </details>
                <div className="actions" style={{ marginTop: 8 }}>
                  <button onClick={() => saveIdea(i)}>У мої страви</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card red">
        <h2>Калорії по фото</h2>
        <p className="muted">Сфотографуйте страву, і ШІ оцінить калорії, БЖВ та інгредієнти.</p>
        <PhotoPicker
          onFile={(f) => void analyse(f)}
          disabled={busy !== null || left === 0}
          busy={busy === 'photo'}
          title="Обрати фото страви"
        />
        {busy === 'photo' && <p className="status" style={{ marginTop: 12 }}>Аналізуємо фото…</p>}
        {meal && !meal.is_food && (
          <p className="status" style={{ marginTop: 12 }}>
            На фото не видно їжі. Спробуйте інше.
          </p>
        )}
        {meal && meal.is_food && (
          <div style={{ marginTop: 16 }}>
            {mealPhoto && (
              <img src={mealPhoto} alt="Ваше фото" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
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
              <small>Це лише оцінка, реальні значення можуть відрізнятися.</small>
            </p>
            <button onClick={saveMeal}>Зберегти як страву</button>
          </div>
        )}
      </section>

      <p>
        <small>
          Фото й побажання надсилаються в Google Gemini. На безкоштовному тарифі Google може
          використовувати такі дані для покращення своїх продуктів, тому не завантажуйте фото з
          людьми чи особисту інформацію.
        </small>
      </p>
    </div>
  )
}
