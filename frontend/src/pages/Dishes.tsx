import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiFetch } from '../api/client'
import { deleteDishPhoto, uploadDishPhoto } from '../api/photos'
import PhotoPicker from '../components/PhotoPicker'
import { usePlan } from '../plan/context'

type Ingredient = { name: string; amount: string }
type DishInput = {
  name: string
  recipe: string
  ingredients: Ingredient[]
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  photo_url: string | null
  favorite: boolean
}
type Dish = DishInput & { id: string }

const EMPTY: DishInput = { name: '', recipe: '', ingredients: [], calories: null, protein_g: null, fat_g: null, carbs_g: null, photo_url: null, favorite: false }

export default function Dishes() {
  const { me, refresh } = usePlan()
  const [dishes, setDishes] = useState<Dish[]>([])
  const [form, setForm] = useState<DishInput>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState('Завантаження…')
  const [uploading, setUploading] = useState(false)
  const [drawing, setDrawing] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [proposal, setProposal] = useState<{ dishId: string; base64: string } | null>(null)
  const [photoQuota, setPhotoQuota] = useState<{ used: number; limit: number } | null>(null)
  const editedPhoto = editingId ? (dishes.find((d) => d.id === editingId)?.photo_url ?? null) : null

  useEffect(() => {
    apiFetch<Dish[]>('/api/dishes')
      .then((d) => {
        setDishes(d)
        setStatus('')
      })
      .catch(() => setStatus('Не вдалося завантажити страви'))
  }, [])

  function setIngredient(i: number, patch: Partial<Ingredient>) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((ing, j) => (j === i ? { ...ing, ...patch } : ing)),
    }))
  }

  const premium = me?.plan === 'premium'

  useEffect(() => {
    if (!premium) return
    apiFetch<{ images_used: number; images_limit: number }>('/api/ai/quota')
      .then((q) => setPhotoQuota({ used: q.images_used, limit: q.images_limit }))
      .catch(() => {})
  }, [premium])

  function drawError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 429) return 'Ліміт ШІ-фото на сьогодні вичерпано. Спробуйте завтра'
      if (e.status === 503) return 'Генерацію фото ще не налаштовано на сервері'
      if (e.status === 502 && e.detail.startsWith('AI is busy')) {
        return 'ШІ зараз перевантажений. Спробуйте за кілька хвилин, цей запит не списано з ліміту'
      }
      if (e.status === 502) {
        const reason = e.detail.includes(': ') ? e.detail.slice(e.detail.indexOf(': ') + 2) : ''
        return `Не вдалося створити фото.${reason ? ` Технічна причина: ${reason}` : ''}`
      }
    }
    return 'Щось пішло не так. Спробуйте ще раз'
  }

  function nutritionError(
    e: unknown,
    failed = 'ШІ не зміг порахувати КБЖВ.',
    fallback = 'Не вдалося порахувати КБЖВ',
  ): string {
    if (e instanceof ApiError) {
      if (e.status === 429) return 'Ліміт запитів до ШІ на сьогодні вичерпано'
      if (e.status === 503) return 'ШІ ще не налаштований на сервері'
      if (e.status === 502 && e.detail.startsWith('AI is busy')) {
        return 'ШІ зараз перевантажений, спробуйте за кілька хвилин'
      }
      if (e.status === 502) {
        const reason = e.detail.includes(': ') ? e.detail.slice(e.detail.indexOf(': ') + 2) : ''
        return `${failed}${reason ? ` Технічна причина: ${reason}` : ''}`
      }
    }
    return fallback
  }

  type Nutrition = Pick<DishInput, 'calories' | 'protein_g' | 'fat_g' | 'carbs_g'>

  async function estimateNutrition(source: DishInput): Promise<Nutrition> {
    const n = await apiFetch<{ calories: number; protein_g: number; fat_g: number; carbs_g: number }>(
      '/api/ai/dish-nutrition',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: source.name,
          recipe: source.recipe,
          ingredients: source.ingredients.filter((i) => i.name.trim()),
        }),
      },
    )
    return { calories: n.calories, protein_g: n.protein_g, fat_g: n.fat_g, carbs_g: n.carbs_g }
  }

  async function fillNutrition() {
    if (!premium) {
      window.dispatchEvent(new CustomEvent('plan-limit', { detail: 'premium_required' }))
      return
    }
    setEstimating(true)
    setStatus('')
    try {
      setForm({ ...form, ...(await estimateNutrition(form)) })
      setStatus('КБЖВ розраховано ШІ. Це оцінка, її можна виправити')
    } catch (e) {
      setStatus(nutritionError(e))
    } finally {
      setEstimating(false)
    }
  }

  const [writing, setWriting] = useState(false)

  async function writeRecipe() {
    if (!premium) {
      window.dispatchEvent(new CustomEvent('plan-limit', { detail: 'premium_required' }))
      return
    }
    const hasContent = form.recipe.trim() || form.ingredients.some((i) => i.name.trim())
    if (hasContent && !confirm('Замінити поточний рецепт та інгредієнти?')) return
    setWriting(true)
    setStatus('')
    try {
      const r = await apiFetch<{ recipe: string; ingredients: Ingredient[] }>('/api/ai/dish-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim() }),
      })
      setForm({ ...form, recipe: r.recipe, ingredients: r.ingredients })
      setStatus('Рецепт і інгредієнти створено ШІ. Перевірте їх і виправте за потреби')
    } catch (e) {
      setStatus(nutritionError(e, 'ШІ не зміг написати рецепт.', 'Не вдалося створити рецепт'))
    } finally {
      setWriting(false)
    }
  }

  async function drawPhoto(d: Dish) {
    if (!premium) {
      window.dispatchEvent(new CustomEvent('plan-limit', { detail: 'premium_required' }))
      return
    }
    setDrawing(d.id)
    setProposal(null)
    setStatus('')
    try {
      const r = await apiFetch<{ image_base64: string }>('/api/ai/dish-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: d.name, ingredients: d.ingredients }),
      })
      setProposal({ dishId: d.id, base64: r.image_base64 })
    } catch (e) {
      setStatus(drawError(e))
    } finally {
      setDrawing(null)
      apiFetch<{ images_used: number; images_limit: number }>('/api/ai/quota')
        .then((q) => setPhotoQuota({ used: q.images_used, limit: q.images_limit }))
        .catch(() => {})
    }
  }

  async function acceptPhoto(d: Dish) {
    if (!proposal) return
    setStatus('Зберігаємо фото…')
    try {
      const blob = await (await fetch(`data:image/jpeg;base64,${proposal.base64}`)).blob()
      const url = await uploadDishPhoto(blob)
      const { id: _id, ...rest } = d
      const updated = await apiFetch<Dish>(`/api/dishes/${d.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rest, photo_url: url }),
      })
      setDishes((ds) => ds.map((x) => (x.id === d.id ? updated : x)))
      void deleteDishPhoto(d.photo_url)
      setProposal(null)
      setStatus('Фото додано до страви')
    } catch {
      setStatus('Не вдалося зберегти фото')
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadDishPhoto(file)
      const old = form.photo_url
      setForm((f) => ({ ...f, photo_url: url }))
      // an unsaved earlier upload would otherwise stay in storage forever
      if (old && old !== editedPhoto) await deleteDishPhoto(old)
      setStatus('')
    } catch {
      setStatus('Не вдалося завантажити фото. Спробуйте інший файл (JPEG, PNG або WebP)')
    } finally {
      setUploading(false)
    }
  }

  const atLimit = me !== null && !editingId && dishes.length >= me.dishes

  async function save(e: FormEvent) {
    e.preventDefault()
    let data = form
    let estimated = false
    let failureNote = ''
    const noNutrition =
      form.calories == null && form.protein_g == null && form.fat_g == null && form.carbs_g == null
    if (premium && noNutrition && form.name.trim()) {
      // premium: fill calories and macros automatically when they were left empty
      setStatus('Рахуємо КБЖВ…')
      try {
        data = { ...form, ...(await estimateNutrition(form)) }
        estimated = true
      } catch (err) {
        failureNote = nutritionError(err)
      }
    }
    const body = JSON.stringify({
      ...data,
      ingredients: data.ingredients.filter((i) => i.name.trim()),
    })
    const init = { headers: { 'Content-Type': 'application/json' }, body }
    try {
      if (editingId) {
        const updated = await apiFetch<Dish>(`/api/dishes/${editingId}`, { ...init, method: 'PUT' })
        setDishes((ds) => ds.map((d) => (d.id === editingId ? updated : d)))
      } else {
        const created = await apiFetch<Dish>('/api/dishes', { ...init, method: 'POST' })
        setDishes((ds) => [created, ...ds])
      }
      if (editedPhoto && editedPhoto !== form.photo_url) await deleteDishPhoto(editedPhoto)
      setForm(EMPTY)
      setEditingId(null)
      setStatus(
        estimated
          ? 'Збережено, КБЖВ розраховано ШІ'
          : failureNote
            ? `Збережено без КБЖВ: ${failureNote}`
            : 'Збережено',
      )
      refresh()
    } catch {
      setStatus('Не вдалося зберегти')
    }
  }

  async function toggleFavorite(d: Dish) {
    const { id: _id, ...rest } = d
    setDishes((ds) => ds.map((x) => (x.id === d.id ? { ...x, favorite: !d.favorite } : x)))
    try {
      await apiFetch<Dish>(`/api/dishes/${d.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rest, favorite: !d.favorite }),
      })
    } catch {
      setDishes((ds) => ds.map((x) => (x.id === d.id ? { ...x, favorite: d.favorite } : x)))
      setStatus('Не вдалося зберегти')
    }
  }

  async function remove(id: string) {
    if (!confirm('Видалити страву?')) return
    try {
      await apiFetch<void>(`/api/dishes/${id}`, { method: 'DELETE' })
      void deleteDishPhoto(dishes.find((d) => d.id === id)?.photo_url ?? null)
      setDishes((ds) => ds.filter((d) => d.id !== id))
      refresh()
    } catch {
      setStatus('Не вдалося видалити')
    }
  }

  function edit(d: Dish) {
    setEditingId(d.id)
    setForm({
      name: d.name,
      recipe: d.recipe,
      ingredients: d.ingredients,
      calories: d.calories,
      protein_g: d.protein_g,
      fat_g: d.fat_g,
      carbs_g: d.carbs_g,
      photo_url: d.photo_url,
      favorite: d.favorite,
    })
  }

  return (
    <div>
      <h1>Мої страви</h1>
      {me && (
        <p className="usage">
          <span>
            Страв: <strong>{dishes.length}</strong> з {me.dishes}
          </span>
          {me.plan === 'free' && <Link to="/pricing">У преміумі до 500</Link>}
          {premium && photoQuota && photoQuota.limit > 0 && (
            <span>
              ШІ-фото сьогодні: <strong>{photoQuota.used}</strong> з {photoQuota.limit}
            </span>
          )}
        </p>
      )}
      <p>
        <Link to="/recipes">Знайти рецепт</Link>
      </p>

      <form onSubmit={save} className="card">
        <h2>{editingId ? 'Редагувати страву' : 'Додати страву'}</h2>
        <label>
          Назва
          <input value={form.name} maxLength={100} required
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <p className="actions" style={{ margin: '-6px 0 18px' }}>
          <button type="button" onClick={writeRecipe} disabled={writing || !form.name.trim()}>
            {writing ? 'Пишемо рецепт…' : 'Згенерувати рецепт та інгредієнти (ШІ)'}
            {!premium && <span className="badge paid" style={{ marginLeft: 8 }}>преміум</span>}
          </button>
          {premium && <small className="muted">Враховує ваш профіль: дієту й алергени</small>}
        </p>
        <div className="row">
        <label>
          Калорії на порцію
          <input type="number" min={0} max={5000} value={form.calories ?? ''}
            onChange={(e) =>
              setForm({ ...form, calories: e.target.value ? Number(e.target.value) : null })
            } />
        </label>
        <label>
          Білки, г
          <input type="number" min={0} max={1000} step={0.1} value={form.protein_g ?? ''}
            onChange={(e) =>
              setForm({ ...form, protein_g: e.target.value ? Number(e.target.value) : null })
            } />
        </label>
        <label>
          Жири, г
          <input type="number" min={0} max={1000} step={0.1} value={form.fat_g ?? ''}
            onChange={(e) =>
              setForm({ ...form, fat_g: e.target.value ? Number(e.target.value) : null })
            } />
        </label>
        <label>
          Вуглеводи, г
          <input type="number" min={0} max={1000} step={0.1} value={form.carbs_g ?? ''}
            onChange={(e) =>
              setForm({ ...form, carbs_g: e.target.value ? Number(e.target.value) : null })
            } />
        </label>
        </div>
        <p className="actions" style={{ margin: '-6px 0 18px' }}>
          <button type="button" onClick={fillNutrition} disabled={estimating || !form.name.trim()}>
            {estimating ? 'Рахуємо…' : 'Порахувати КБЖВ (ШІ)'}
            {!premium && <span className="badge paid" style={{ marginLeft: 8 }}>преміум</span>}
          </button>
          {premium && (
            <small className="muted">
              Якщо залишити порожнім, ШІ порахує автоматично під час збереження
            </small>
          )}
        </p>
        <fieldset>
          <legend>Інгредієнти</legend>
          {form.ingredients.map((ing, i) => (
            <div key={i}>
              <input placeholder="Назва" value={ing.name} maxLength={100}
                onChange={(e) => setIngredient(i, { name: e.target.value })} />
              <input placeholder="Кількість" value={ing.amount} maxLength={50}
                onChange={(e) => setIngredient(i, { amount: e.target.value })} />
              <button type="button"
                onClick={() =>
                  setForm({ ...form, ingredients: form.ingredients.filter((_, j) => j !== i) })
                }>
                ×
              </button>
            </div>
          ))}
          <button type="button"
            onClick={() =>
              setForm({ ...form, ingredients: [...form.ingredients, { name: '', amount: '' }] })
            }>
            + Інгредієнт
          </button>
        </fieldset>
        <div className="photo-field">
          <strong style={{ fontSize: '0.92rem' }}>Фото</strong>
          <div className="photo-row">
            {form.photo_url && <img src={form.photo_url} alt="Фото страви" />}
            <div className="photo-controls">
              <PhotoPicker
                onFile={(f) => void pickPhoto(f)}
                disabled={uploading}
                busy={uploading}
                title={form.photo_url ? 'Замінити фото' : 'Обрати фото'}
              />
              {form.photo_url && !uploading && (
                <button type="button" className="danger"
                  onClick={() => {
                    if (form.photo_url !== editedPhoto) void deleteDishPhoto(form.photo_url)
                    setForm({ ...form, photo_url: null })
                  }}>
                  Прибрати фото
                </button>
              )}
            </div>
          </div>
        </div>
        <label>
          Рецепт
          <textarea value={form.recipe} maxLength={5000}
            onChange={(e) => setForm({ ...form, recipe: e.target.value })} />
        </label>
        <div className="actions">
        <button type="submit" disabled={atLimit}>
          {editingId ? 'Зберегти зміни' : 'Додати'}
        </button>
        {atLimit && (
          <span className="muted">
            Ліміт страв вичерпано. Видаліть зайві або <Link to="/pricing">перейдіть на преміум</Link>.
          </span>
        )}
        {editingId && (
          <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY) }}>
            Скасувати
          </button>
        )}
        </div>
      </form>

      {status && <p className="status">{status}</p>}

      <ul className="cards">
        {[...dishes].sort((a, b) => Number(b.favorite) - Number(a.favorite)).map((d) => (
          <li key={d.id}>
            <div className="media">
              {d.photo_url ? (
                <img className="thumb" src={d.photo_url} alt="" loading="lazy" />
              ) : (
                <div className="thumb empty">🍽</div>
              )}
              <div>
            <button
              type="button"
              className={`star${d.favorite ? ' on' : ''}`}
              aria-pressed={d.favorite}
              aria-label={d.favorite ? 'Прибрати з улюблених' : 'Додати до улюблених'}
              onClick={() => toggleFavorite(d)}
            >
              {d.favorite ? '★' : '☆'}
            </button>
            <strong>{d.name}</strong>
            {d.calories != null && ` · ${d.calories} ккал`}
            {(d.protein_g != null || d.fat_g != null || d.carbs_g != null) &&
              ` · Б ${d.protein_g ?? 0} / Ж ${d.fat_g ?? 0} / В ${d.carbs_g ?? 0} г`}
            {d.ingredients.length > 0 && (
              <div>{d.ingredients.map((i) => `${i.name}${i.amount ? ` (${i.amount})` : ''}`).join(', ')}</div>
            )}
            <div className="actions" style={{ marginTop: 8 }}>
            <button onClick={() => drawPhoto(d)} disabled={drawing !== null}>
              {drawing === d.id ? 'Малюємо…' : 'Фото від ШІ'}
              {!premium && <span className="badge paid" style={{ marginLeft: 8 }}>преміум</span>}
            </button>
            <button onClick={() => edit(d)}>Редагувати</button>
            <button className="danger" onClick={() => remove(d.id)}>
              Видалити
            </button>
            </div>
            {drawing === d.id && (
              <p className="muted" style={{ margin: '8px 0 0' }}>
                Малюємо фото, це може зайняти до пів хвилини…
              </p>
            )}
            {proposal?.dishId === d.id && (
              <div className="proposal">
                <img src={`data:image/jpeg;base64,${proposal.base64}`} alt="Фото від ШІ" />
                <div className="actions">
                  <button onClick={() => acceptPhoto(d)}>Використати це фото</button>
                  <button onClick={() => drawPhoto(d)} disabled={drawing !== null}>
                    Ще раз
                  </button>
                  <button onClick={() => setProposal(null)}>Скасувати</button>
                </div>
              </div>
            )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!status && dishes.length === 0 && <p>Страв поки немає. Додайте першу.</p>}
    </div>
  )
}
