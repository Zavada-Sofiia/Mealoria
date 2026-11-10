import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../api/client'

type Ingredient = { name: string; amount: string }
type DishInput = {
  name: string
  recipe: string
  ingredients: Ingredient[]
  calories: number | null
}
type Dish = DishInput & { id: string }

const EMPTY: DishInput = { name: '', recipe: '', ingredients: [], calories: null }

export default function Dishes() {
  const [dishes, setDishes] = useState<Dish[]>([])
  const [form, setForm] = useState<DishInput>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState('Завантаження…')

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

  async function save(e: FormEvent) {
    e.preventDefault()
    const body = JSON.stringify({
      ...form,
      ingredients: form.ingredients.filter((i) => i.name.trim()),
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
      setForm(EMPTY)
      setEditingId(null)
      setStatus('Збережено')
    } catch {
      setStatus('Не вдалося зберегти')
    }
  }

  async function remove(id: string) {
    if (!confirm('Видалити страву?')) return
    try {
      await apiFetch<void>(`/api/dishes/${id}`, { method: 'DELETE' })
      setDishes((ds) => ds.filter((d) => d.id !== id))
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
    })
  }

  return (
    <div>
      <h1>Мої страви</h1>

      <form onSubmit={save}>
        <h2>{editingId ? 'Редагувати страву' : 'Додати страву'}</h2>
        <label>
          Назва
          <input value={form.name} maxLength={100} required
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Калорії на порцію
          <input type="number" min={0} max={5000} value={form.calories ?? ''}
            onChange={(e) =>
              setForm({ ...form, calories: e.target.value ? Number(e.target.value) : null })
            } />
        </label>
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
        <label>
          Рецепт
          <textarea value={form.recipe} maxLength={5000}
            onChange={(e) => setForm({ ...form, recipe: e.target.value })} />
        </label>
        <button type="submit">{editingId ? 'Зберегти зміни' : 'Додати'}</button>
        {editingId && (
          <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY) }}>
            Скасувати
          </button>
        )}
      </form>

      {status && <p>{status}</p>}

      <ul>
        {dishes.map((d) => (
          <li key={d.id}>
            <strong>{d.name}</strong>
            {d.calories != null && ` · ${d.calories} ккал`}
            {d.ingredients.length > 0 && (
              <div>{d.ingredients.map((i) => `${i.name}${i.amount ? ` (${i.amount})` : ''}`).join(', ')}</div>
            )}
            <button onClick={() => edit(d)}>Редагувати</button>
            <button onClick={() => remove(d.id)}>Видалити</button>
          </li>
        ))}
      </ul>
      {!status && dishes.length === 0 && <p>Страв поки немає. Додайте першу.</p>}
    </div>
  )
}
