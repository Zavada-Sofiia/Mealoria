import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../api/client'

type ProfileData = {
  sex: 'male' | 'female'
  age: number
  height_cm: number
  weight_kg: number
  activity: 'sedentary' | 'light' | 'moderate' | 'active'
  goal: 'lose' | 'maintain' | 'gain'
  meals_per_day: number
  target_calories: number | null
  preferences: string
  allergies: string
}

type ProfileResponse = { profile: ProfileData | null; recommended_calories: number | null }

const EMPTY: ProfileData = {
  sex: 'female',
  age: 25,
  height_cm: 165,
  weight_kg: 60,
  activity: 'light',
  goal: 'maintain',
  meals_per_day: 3,
  target_calories: null,
  preferences: '',
  allergies: '',
}

export default function Profile() {
  const [form, setForm] = useState<ProfileData>(EMPTY)
  const [recommended, setRecommended] = useState<number | null>(null)
  const [status, setStatus] = useState('Завантаження…')

  useEffect(() => {
    apiFetch<ProfileResponse>('/api/profile')
      .then((r) => {
        if (r.profile) setForm(r.profile)
        setRecommended(r.recommended_calories)
        setStatus('')
      })
      .catch(() => setStatus('Не вдалося завантажити профіль'))
  }, [])

  function set<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setStatus('Зберігаємо…')
    try {
      const r = await apiFetch<ProfileResponse>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setRecommended(r.recommended_calories)
      setStatus('Збережено')
    } catch {
      setStatus('Не вдалося зберегти')
    }
  }

  return (
    <form onSubmit={save}>
      <h1>Профіль</h1>

      <label>
        Стать
        <select value={form.sex} onChange={(e) => set('sex', e.target.value as ProfileData['sex'])}>
          <option value="female">Жінка</option>
          <option value="male">Чоловік</option>
        </select>
      </label>
      <label>
        Вік
        <input type="number" min={10} max={100} value={form.age}
          onChange={(e) => set('age', Number(e.target.value))} required />
      </label>
      <label>
        Зріст, см
        <input type="number" min={100} max={250} value={form.height_cm}
          onChange={(e) => set('height_cm', Number(e.target.value))} required />
      </label>
      <label>
        Вага, кг
        <input type="number" min={30} max={300} step={0.1} value={form.weight_kg}
          onChange={(e) => set('weight_kg', Number(e.target.value))} required />
      </label>
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
      <label>
        Прийомів їжі на день
        <input type="number" min={1} max={8} value={form.meals_per_day}
          onChange={(e) => set('meals_per_day', Number(e.target.value))} required />
      </label>
      <label>
        Бажаний калораж{recommended ? ` (рекомендовано: ${recommended})` : ''}
        <input type="number" min={800} max={6000} value={form.target_calories ?? ''}
          placeholder={recommended ? String(recommended) : ''}
          onChange={(e) => set('target_calories', e.target.value ? Number(e.target.value) : null)} />
      </label>
      <label>
        Вподобання
        <textarea maxLength={1000} value={form.preferences}
          onChange={(e) => set('preferences', e.target.value)} />
      </label>
      <label>
        Алергії
        <textarea maxLength={1000} value={form.allergies}
          onChange={(e) => set('allergies', e.target.value)} />
      </label>

      <button type="submit">Зберегти</button>
      {status && <p>{status}</p>}
    </form>
  )
}
