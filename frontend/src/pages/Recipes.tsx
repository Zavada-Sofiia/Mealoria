import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

type Recipe = {
  id: string
  name: string
  category: string
  recipe: string
  ingredients: { name: string; amount: string }[]
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  diet: string
  allergens: string[]
  cuisine: string | null
  cook_minutes: number
  budget: string
  photo_url: string | null
}
type Dish = { id: string }

const CATEGORIES = ['сніданок', 'обід', 'вечеря', 'перекус']
const DIET_LABEL: Record<string, string> = {
  vegan: 'веганське',
  vegetarian: 'вегетаріанське',
  pescatarian: 'з рибою',
}
const ALLERGEN_LABEL: Record<string, string> = {
  gluten: 'глютен',
  lactose: 'лактоза',
  nuts: 'горіхи',
  peanuts: 'арахіс',
  eggs: 'яйця',
  fish: 'риба',
  seafood: 'морепродукти',
  soy: 'соя',
}
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [forMe, setForMe] = useState(false)
  const [status, setStatus] = useState('Завантаження…')
  const [planning, setPlanning] = useState<string | null>(null)
  const [date, setDate] = useState(today())
  const [slot, setSlot] = useState(0)

  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      apiFetch<Recipe[]>(`/api/recipes?q=${encodeURIComponent(query)}&for_me=${forMe}`)
        .then((r) => {
          if (!current) return
          setRecipes(r)
          setStatus('')
        })
        .catch(() => current && setStatus('Не вдалося завантажити рецепти'))
    }, 250)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query, forMe])

  const json = { 'Content-Type': 'application/json' }

  async function saveToDishes(r: Recipe) {
    try {
      await apiFetch<Dish>(`/api/recipes/${r.id}/save`, { method: 'POST' })
      setStatus(`«${r.name}» додано до моїх страв`)
    } catch {
      setStatus('Не вдалося додати страву')
    }
  }

  async function addToCalendar(r: Recipe) {
    try {
      const dish = await apiFetch<Dish>(`/api/recipes/${r.id}/save`, { method: 'POST' })
      await apiFetch('/api/calendar', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ date, slot, dish_id: dish.id }),
      })
      setPlanning(null)
      setStatus(`«${r.name}» додано в календар на ${date}`)
    } catch {
      setStatus('Не вдалося додати в календар')
    }
  }

  const shown = recipes.filter((r) => !category || r.category === category)

  return (
    <div>
      <h1>Рецепти</h1>
      <div className="actions" style={{ marginBottom: 12 }}>
        <input placeholder="Пошук за назвою" value={query} style={{ maxWidth: 320 }}
          onChange={(e) => setQuery(e.target.value)} />
        <select value={category} style={{ width: 'auto' }} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Усі категорії</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <p>
        <label className="inline">
          <input type="checkbox" checked={forMe} onChange={(e) => setForMe(e.target.checked)} />{' '}
          Враховувати мої вподобання (дієта, алергени, час, бюджет)
        </label>
      </p>
      {forMe && (
        <p>
          <small>
            Фільтр працює за відповідями з профілю. Інші алергії, вписані текстом, не враховуються,
            тому завжди перевіряйте склад самостійно.
          </small>
        </p>
      )}
      {status && <p className="status">{status}</p>}

      <ul className="cards">
        {shown.map((r) => (
          <li key={r.id}>
            <div className="media">
              {r.photo_url ? (
                <img className="thumb" src={r.photo_url} alt={r.name} loading="lazy" />
              ) : (
                <div className="thumb empty">🍽</div>
              )}
              <div>
            <strong>{r.name}</strong> · {r.category} · {r.calories} ккал · Б {r.protein_g} / Ж{' '}
            {r.fat_g} / В {r.carbs_g} г
            <div>
              <small>
                {r.cook_minutes} хв
                {r.diet !== 'any' && ` · ${DIET_LABEL[r.diet]}`}
                {r.allergens.length > 0 &&
                  ` · містить: ${r.allergens.map((a) => ALLERGEN_LABEL[a] ?? a).join(', ')}`}
              </small>
            </div>
            <details>
              <summary>Рецепт</summary>
              <div>{r.ingredients.map((i) => `${i.name} (${i.amount})`).join(', ')}</div>
              <p>{r.recipe}</p>
            </details>
            <div className="actions" style={{ marginTop: 8 }}>
              <button onClick={() => saveToDishes(r)}>У мої страви</button>
              <button onClick={() => setPlanning(planning === r.id ? null : r.id)}>В календар</button>
            </div>
            {planning === r.id && (
              <div className="actions" style={{ marginTop: 8 }}>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <select value={slot} style={{ width: 'auto' }} onChange={(e) => setSlot(Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => (
                    <option key={s} value={s}>
                      Прийом {s + 1}
                    </option>
                  ))}
                </select>{' '}
                <button onClick={() => addToCalendar(r)}>Додати</button>
              </div>
            )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!status && shown.length === 0 && <p>Нічого не знайдено.</p>}
      <p>
        <small>Фото в каталозі створені штучним інтелектом і мають ілюстративний характер.</small>
      </p>
    </div>
  )
}
