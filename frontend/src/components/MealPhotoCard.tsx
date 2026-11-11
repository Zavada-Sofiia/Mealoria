import { useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../api/client'
import { blobToBase64, compressImage, uploadDishPhoto } from '../api/photos'
import { supabase } from '../api/supabase'
import { aiErrorText } from '../aiError'
import { kcalMacros } from '../macros'
import { t } from '../i18n'
import PhotoPicker from './PhotoPicker'

type Ingredient = { name: string; amount: string }
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

const json = { 'Content-Type': 'application/json' }
const key = (userId: string) => `mealoria.photo.v1.${userId}`

/** Calories of a dish from its photo (AI). The result stays in this browser until the next photo. */
export default function MealPhotoCard() {
  const [userId, setUserId] = useState('')
  const [quota, setQuota] = useState<Quota | null>(null)
  const [meal, setMeal] = useState<MealPhoto | null>(null)
  const [photo, setPhoto] = useState<string | null>(null) // compressed photo as a data URL
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id ?? ''
      setUserId(id)
      try {
        const raw = id ? localStorage.getItem(key(id)) : null
        if (raw) {
          const parsed = JSON.parse(raw)
          setMeal(parsed.meal ?? null)
          setPhoto(parsed.photo ?? null)
        }
      } catch {
        // nothing saved, or storage is blocked
      }
    })
    apiFetch<Quota>('/api/ai/quota').then(setQuota).catch(() => {})
  }, [])

  useEffect(() => {
    if (!userId) return
    try {
      if (meal) localStorage.setItem(key(userId), JSON.stringify({ meal, photo }))
      else localStorage.removeItem(key(userId))
    } catch {
      // storage full or blocked: the result just will not survive leaving the page
    }
  }, [userId, meal, photo])

  const left = quota ? Math.max(0, quota.limit - quota.used) : null

  async function analyse(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setStatus('')
    setMeal(null)
    setSaved(false)
    try {
      const image_base64 = await blobToBase64(await compressImage(file))
      setPhoto(`data:image/jpeg;base64,${image_base64}`)
      setMeal(
        await apiFetch<MealPhoto>('/api/ai/meal-photo', {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ image_base64, mime_type: 'image/jpeg' }),
        }),
      )
    } catch (err) {
      setStatus(err instanceof ApiError ? aiErrorText(err) : t('Не вдалося обробити фото'))
    } finally {
      setBusy(false)
      apiFetch<Quota>('/api/ai/quota').then(setQuota).catch(() => {})
    }
  }

  async function save() {
    if (!meal || !photo || saved) return
    setSaved(true)
    try {
      const photo_url = await uploadDishPhoto(await (await fetch(photo)).blob())
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
      setPhoto(null)
      setSaved(false)
    } catch {
      setSaved(false)
      setStatus(t('Не вдалося зберегти страву'))
    }
  }

  return (
    <section className="card red">
      <h2 style={{ marginTop: 0 }}>{t('Калорії по фото')}</h2>
      <p className="muted">
        {t('Сфотографуйте страву, і ШІ оцінить калорії, БЖВ та інгредієнти.')}
        {quota && ` ${t('Сьогодні використано {used} з {limit} запитів до ШІ.', { used: quota.used, limit: quota.limit })}`}
      </p>
      <PhotoPicker
        onFile={(f) => void analyse(f)}
        disabled={busy || left === 0}
        busy={busy}
        title={t('Обрати фото страви')}
      />
      {busy && <p className="status" style={{ marginTop: 12 }}>{t('Аналізуємо фото…')}</p>}
      {status && <p className="status" style={{ marginTop: 12 }}>{status}</p>}
      {meal && !meal.is_food && (
        <p className="status" style={{ marginTop: 12 }}>{t('На фото не видно їжі. Спробуйте інше.')}</p>
      )}
      {meal && meal.is_food && (
        <div style={{ marginTop: 16 }}>
          {photo && (
            <img src={photo} alt={t('Ваше фото')} style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
          )}
          <h3>{meal.name}</h3>
          <p>
            <strong>{kcalMacros(meal)}</strong>
          </p>
          <p className="muted">{meal.ingredients.map((x) => `${x.name} (${x.amount})`).join(', ')}</p>
          {meal.comment && <p className="muted">{meal.comment}</p>}
          <p>
            <small>{t('Це лише оцінка, реальні значення можуть відрізнятися.')}</small>
          </p>
          <button onClick={save} disabled={saved}>
            {saved ? t('Додано ✓') : t('Зберегти як страву')}
          </button>
        </div>
      )}
      <p>
        <small className="muted">
          {t('Фото страви надсилається в Google Gemini. На безкоштовному тарифі Google може використовувати такі дані для покращення своїх продуктів, тому не завантажуйте фото з людьми чи особисту інформацію.')}
        </small>
      </p>
    </section>
  )
}
