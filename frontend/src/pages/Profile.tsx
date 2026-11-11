import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import RangeField from '../components/RangeField'
import { estimateCalories } from '../calories'

type ProfileData = {
  sex: 'male' | 'female'
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  activity: 'sedentary' | 'light' | 'moderate' | 'active'
  goal: 'lose' | 'maintain' | 'gain'
  meals_per_day: number
  target_calories: number | null
  diet: string
  allergens: string[]
  cuisines: string[]
  cook_time: string
  budget: string
  preferences: string
  allergies: string
}

type ProfileResponse = { profile: ProfileData | null; recommended_calories: number | null }

const EMPTY: ProfileData = {
  sex: 'female',
  age: null,
  height_cm: null,
  weight_kg: null,
  activity: 'light',
  goal: 'maintain',
  meals_per_day: 3,
  target_calories: null,
  diet: 'any',
  allergens: [],
  cuisines: [],
  cook_time: 'any',
  budget: 'any',
  preferences: '',
  allergies: '',
}

const DIETS = [
  ['any', 'Їм усе'],
  ['vegetarian', 'Вегетаріанське'],
  ['vegan', 'Веганське'],
  ['pescatarian', 'Пескетаріанське (з рибою)'],
]
const ALLERGENS = [
  ['gluten', 'Глютен'],
  ['lactose', 'Лактоза'],
  ['nuts', 'Горіхи'],
  ['peanuts', 'Арахіс'],
  ['eggs', 'Яйця'],
  ['fish', 'Риба'],
  ['seafood', 'Морепродукти'],
  ['soy', 'Соя'],
]
const CUISINES = [
  ['ukrainian', 'Українська'],
  ['italian', 'Італійська'],
  ['asian', 'Азійська'],
  ['georgian', 'Грузинська'],
  ['mediterranean', 'Середземноморська'],
]
const COOK_TIMES = [
  ['15', 'До 15 хвилин'],
  ['30', 'До 30 хвилин'],
  ['60', 'До години'],
  ['any', 'Не важливо'],
]
const BUDGETS = [
  ['low', 'Економно'],
  ['medium', 'Середній'],
  ['any', 'Не важливо'],
]

function Choice({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: string[][]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.map(([key, label]) => (
        <label key={key}>
          <input type="radio" name={legend} checked={value === key} onChange={() => onChange(key)} />{' '}
          {label}{' '}
        </label>
      ))}
    </fieldset>
  )
}

function Multi({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: string[][]
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={value.includes(key)}
            onChange={() =>
              onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key])
            }
          />{' '}
          {label}{' '}
        </label>
      ))}
    </fieldset>
  )
}

export default function Profile() {
  const [form, setForm] = useState<ProfileData>(EMPTY)
  const [status, setStatus] = useState('Завантаження…')

  useEffect(() => {
    apiFetch<ProfileResponse>('/api/profile')
      .then((r) => {
        if (r.profile) setForm(r.profile)
        setStatus('')
      })
      .catch(() => setStatus('Не вдалося завантажити профіль'))
  }, [])

  function set<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const estimate = estimateCalories(form)
  const recommended = estimate?.recommended ?? null
  const customTarget = form.target_calories !== null && form.target_calories !== recommended

  async function save(e: FormEvent) {
    e.preventDefault()
    if (form.age === null || form.height_cm === null || form.weight_kg === null) {
      setStatus('Вкажіть вік, зріст і вагу')
      return
    }
    setStatus('Зберігаємо…')
    try {
      await apiFetch<ProfileResponse>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus('Збережено')
    } catch {
      setStatus('Не вдалося зберегти')
    }
  }

  return (
    <form onSubmit={save}>
      <h1>Профіль</h1>

      <section className="card">
      <h2 style={{ marginTop: 0 }}>Про вас</h2>
      <label>
        Стать
        <select value={form.sex} onChange={(e) => set('sex', e.target.value as ProfileData['sex'])}>
          <option value="female">Жінка</option>
          <option value="male">Чоловік</option>
        </select>
      </label>
      <RangeField label="Вік" unit="років" min={10} max={100} value={form.age}
        placeholder="—" onChange={(v) => set('age', v)} />
      <RangeField label="Зріст" unit="см" min={100} max={250} value={form.height_cm}
        placeholder="—" onChange={(v) => set('height_cm', v)} />
      <RangeField label="Вага" unit="кг" min={30} max={200} value={form.weight_kg}
        placeholder="—" decimals onChange={(v) => set('weight_kg', v)} />
      <label>
        Активність
        <select value={form.activity}
          onChange={(e) => set('activity', e.target.value as ProfileData['activity'])}>
          <option value="sedentary">Сидячий спосіб життя</option>
          <option value="light">Легка (1–3 тренування на тиждень)</option>
          <option value="moderate">Помірна (3–5 тренувань)</option>
          <option value="active">Висока (6–7 тренувань)</option>
        </select>
      </label>
      <label>
        Мета
        <select value={form.goal} onChange={(e) => set('goal', e.target.value as ProfileData['goal'])}>
          <option value="lose">Схуднути</option>
          <option value="maintain">Підтримувати вагу</option>
          <option value="gain">Набрати вагу</option>
        </select>
      </label>
      <RangeField label="Прийомів їжі на день" unit="разів" min={1} max={8}
        value={form.meals_per_day}
        onChange={(v) => set('meals_per_day', v ?? 3)} />
      <div className="calc">
        {estimate ? (
          <>
            <div className="calc-main">
              <span className="calc-num">{form.target_calories ?? estimate.recommended}</span>
              <span>ккал на добу{customTarget ? ' (ваша ціль)' : ''}</span>
            </div>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Рекомендовано {estimate.recommended} ккал: базовий обмін {estimate.bmr} ккал ×
              активність {estimate.activityFactor} = {estimate.tdee} ккал
              {estimate.goalFactor !== 1 ? `, мета ×${estimate.goalFactor}` : ''}. Розрахунок за
              формулою Міффліна–Сан-Жеора.
            </p>
            {customTarget && (
              <button type="button" style={{ marginTop: 10 }}
                onClick={() => set('target_calories', null)}>
                Повернути рекомендований ({estimate.recommended})
              </button>
            )}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Вкажіть вік, зріст і вагу, і ми одразу порахуємо вашу норму калорій.
          </p>
        )}
      </div>
      <label>
        Своя ціль, ккал (необов'язково)
        <input type="number" inputMode="numeric" min={800} max={6000}
          value={form.target_calories ?? ''}
          placeholder={recommended ? `Зараз використовується ${recommended}` : 'Автоматично'}
          onChange={(e) => set('target_calories', e.target.value ? Number(e.target.value) : null)} />
      </label>
      </section>

      <section className="card red">
      <h2 style={{ marginTop: 0 }}>Вподобання</h2>
      <Choice legend="Тип харчування" options={DIETS} value={form.diet}
        onChange={(v) => set('diet', v)} />
      <Multi legend="Алергії та непереносимість" options={ALLERGENS} value={form.allergens}
        onChange={(v) => set('allergens', v)} />
      <Multi legend="Улюблені кухні" options={CUISINES} value={form.cuisines}
        onChange={(v) => set('cuisines', v)} />
      <Choice legend="Скільки часу готуєте" options={COOK_TIMES} value={form.cook_time}
        onChange={(v) => set('cook_time', v)} />
      <Choice legend="Бюджет" options={BUDGETS} value={form.budget}
        onChange={(v) => set('budget', v)} />
      <label>
        Що не любите чи не їсте
        <textarea maxLength={1000} value={form.preferences}
          onChange={(e) => set('preferences', e.target.value)} />
      </label>
      <label>
        Інші алергії
        <textarea maxLength={1000} value={form.allergies}
          onChange={(e) => set('allergies', e.target.value)} />
      </label>

      </section>

      <div className="actions">
      <button type="submit" className="big">Зберегти</button>
      </div>
      {status && <p className="status" style={{ marginTop: 16 }}>{status}</p>}
      <p style={{ marginTop: 16 }}>
        <Link to="/pricing">Тариф і оплата</Link> · <Link to="/support">Підтримати проєкт</Link>
      </p>
    </form>
  )
}
