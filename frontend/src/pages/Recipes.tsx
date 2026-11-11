import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { fmtDate } from '../dates'
import ServingsPicker from '../components/ServingsPicker'
import { scaleAmount, useServings } from '../servings'
import { oneStepPerLine } from '../steps'
import { t } from '../i18n'

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
  sesame: 'кунжут',
  mustard: 'гірчиця',
  celery: 'селера',
  honey: 'мед',
  citrus: 'цитрусові',
  berries: 'ягоди',
  cocoa: 'какао',
  mushrooms: 'гриби',
  corn: 'кукурудза',
  legumes: 'бобові',
  tomatoes: 'томати',
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
  const [status, setStatus] = useState(t('Завантаження…'))
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
        .catch(() => current && setStatus(t('Не вдалося завантажити рецепти')))
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
      setStatus(t('«{name}» додано до моїх страв', { name: r.name }))
    } catch {
      setStatus(t('Не вдалося додати страву'))
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
      setStatus(t('«{name}» додано в календар на {date}', { name: r.name, date: fmtDate(date) }))
    } catch {
      setStatus(t('Не вдалося додати в календар'))
    }
  }

  const [servings, setServings] = useServings()
  const shown = recipes
    .filter((r) => !category || r.category === category)
    .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category))

  return (
    <div>
      <h1>{t('Рецепти')}</h1>
      <ServingsPicker value={servings} onChange={setServings} />
      <div className="actions" style={{ marginBottom: 12 }}>
        <input placeholder={t('Пошук за назвою')} value={query} style={{ maxWidth: 320 }}
          onChange={(e) => setQuery(e.target.value)} />
        <select value={category} style={{ width: 'auto' }} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('Усі категорії')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
      </div>
      <p>
        <label className="inline">
          <input type="checkbox" checked={forMe} onChange={(e) => setForMe(e.target.checked)} />{' '}
          {t('Враховувати мої вподобання (дієта, алергени, час, бюджет)')}
        </label>
      </p>
      {forMe && (
        <p>
          <small>
            {t('Фільтр працює за відповідями з профілю. Інші алергії, вписані текстом, не враховуються, тому завжди перевіряйте склад самостійно.')}
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
            <strong>{r.name}</strong> · {t(r.category)} · {r.calories} {t('ккал')} ·{' '}
            {t('Б {p} · Ж {f} · В {c} г', { p: r.protein_g, f: r.fat_g, c: r.carbs_g })}
            <div>
              <small>
                {t('{n} хв', { n: r.cook_minutes })}
                {r.diet !== 'any' && ` · ${t(DIET_LABEL[r.diet])}`}
                {r.allergens.length > 0 &&
                  t(' · містить: {list}', { list: r.allergens.map((a) => t(ALLERGEN_LABEL[a] ?? a)).join(', ') })}
              </small>
            </div>
            <details>
              <summary>{t('Рецепт')}</summary>
              <div>
                {servings > 1 && <strong>{t('На {n}: ', { n: servings })}</strong>}
                {r.ingredients.map((i) => `${i.name} (${scaleAmount(i.amount, servings)})`).join(', ')}
              </div>
              <p style={{ whiteSpace: 'pre-line' }}>{oneStepPerLine(r.recipe)}</p>
            </details>
            <div className="actions" style={{ marginTop: 8 }}>
              <button onClick={() => saveToDishes(r)}>{t('У мої страви')}</button>
              <button onClick={() => setPlanning(planning === r.id ? null : r.id)}>{t('В календар')}</button>
            </div>
            {planning === r.id && (
              <div className="actions" style={{ marginTop: 8 }}>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <select value={slot} style={{ width: 'auto' }} onChange={(e) => setSlot(Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => (
                    <option key={s} value={s}>
                      {t('Прийом {n}', { n: s + 1 })}
                    </option>
                  ))}
                </select>{' '}
                <button onClick={() => addToCalendar(r)}>{t('Додати')}</button>
              </div>
            )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!status && shown.length === 0 && <p>{t('Нічого не знайдено.')}</p>}
      <p>
        <small>{t('Фото в каталозі створені штучним інтелектом і мають ілюстративний характер.')}</small>
      </p>
    </div>
  )
}
