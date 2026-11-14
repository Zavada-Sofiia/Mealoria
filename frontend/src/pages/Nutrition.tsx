import { useEffect, useState } from 'react'
import StatusLine from '../components/StatusLine'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { addDays, iso } from '../dates'
import { locale, t } from '../i18n'
import { targetsFromProfile, type Targets } from '../nutrition'
import { energyUnit, showEnergy, showMl, showWater, waterPresets } from '../units'

type Day = {
  target: number | null
  total: { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number }
}
type ProfileResponse = Parameters<typeof targetsFromProfile>[0]
type WaterEntry = { id: string; amount_ml: number; created_at: string }
type WaterDay = { total_ml: number; entries: WaterEntry[] }

const NUTRIENTS = [
  ['Білки', 'protein_g'],
  ['Жири', 'fat_g'],
  ['Вуглеводи', 'carbs_g'],
  ['Клітковина', 'fiber_g'],
] as const

export default function Nutrition() {
  const [date, setDate] = useState(() => new Date())
  const [day, setDay] = useState<Day | null>(null)
  const [targets, setTargets] = useState<Targets | null>(null)
  const [profileFilled, setProfileFilled] = useState(true)
  const [water, setWater] = useState<WaterDay>({ total_ml: 0, entries: [] })
  const [status, setStatus] = useState(t('Завантаження…'))
  const key = iso(date)

  useEffect(() => {
    apiFetch<ProfileResponse>('/api/profile')
      .then((r) => {
        setTargets(targetsFromProfile(r))
        setProfileFilled(!!r?.profile)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let current = true
    Promise.all([apiFetch<Day>(`/api/calories/day?date=${key}`), apiFetch<WaterDay>(`/api/water?day=${key}`)])
      .then(([d, w]) => {
        if (!current) return
        setDay(d)
        setWater(w)
        setStatus('')
      })
      .catch(() => current && setStatus(t('Не вдалося завантажити дані')))
    return () => {
      current = false
    }
  }, [key])

  function goTo(d: Date) {
    setStatus(t('Завантаження…'))
    setDate(d)
  }

  /** The glass appears at once and is saved in the background. */
  async function addWater(ml: number) {
    const temp: WaterEntry = { id: `tmp-${Date.now()}`, amount_ml: ml, created_at: new Date().toISOString() }
    setWater((w) => ({ total_ml: w.total_ml + ml, entries: [...w.entries, temp] }))
    try {
      const saved = await apiFetch<WaterEntry>('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: key, amount_ml: ml }),
      })
      setWater((w) => ({ ...w, entries: w.entries.map((e) => (e.id === temp.id ? saved : e)) }))
    } catch {
      setWater((w) => ({ total_ml: w.total_ml - ml, entries: w.entries.filter((e) => e.id !== temp.id) }))
      setStatus(t('Не вдалося додати воду'))
    }
  }

  async function removeWater(entry: WaterEntry) {
    if (entry.id.startsWith('tmp-')) return
    setWater((w) => ({ total_ml: w.total_ml - entry.amount_ml, entries: w.entries.filter((e) => e.id !== entry.id) }))
    try {
      await apiFetch<void>(`/api/water/${entry.id}`, { method: 'DELETE' })
    } catch {
      setWater((w) => ({ total_ml: w.total_ml + entry.amount_ml, entries: [...w.entries, entry] }))
      setStatus(t('Не вдалося видалити'))
    }
  }

  const drunk = water.total_ml
  const waterTarget = targets?.water_ml ?? null
  const kcalTarget = day?.target ?? null

  return (
    <div>
      <h1>{t('Норма дня')}</h1>
      <div className="week-nav">
        <button onClick={() => goTo(addDays(date, -1))}>←</button>
        <input type="date" value={key} onChange={(e) => e.target.value && goTo(new Date(e.target.value + 'T00:00'))} />
        <button onClick={() => goTo(addDays(date, 1))}>→</button>
        <button onClick={() => goTo(new Date())}>{t('Сьогодні')}</button>
      </div>
      <StatusLine text={status} />

      {!profileFilled && (
        <section className="card red">
          <p>{t('Щоб побачити норму, заповніть профіль: вагу, мету й активність.')}</p>
          <Link to="/profile">
            <button>{t('Заповнити профіль')}</button>
          </Link>
        </section>
      )}

      {day && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>{t('Калорії та поживні речовини')}</h2>
          <p>
            <strong style={{ fontSize: '1.4rem' }}>{showEnergy(day.total.kcal)}</strong>
            {kcalTarget ? ` / ${showEnergy(kcalTarget)} ${energyUnit()}` : ` ${energyUnit()}`}
          </p>
          {kcalTarget ? (
            <progress className={day.total.kcal > kcalTarget ? 'over' : undefined}
              value={Math.min(day.total.kcal, kcalTarget)} max={kcalTarget} />
          ) : null}
          {targets && (
            <div className="nutrients">
              {NUTRIENTS.map(([label, k]) => {
                const eaten = day.total[k] ?? 0
                return (
                  <div key={k}>
                    <div className="nutrient-head">
                      <span>{t(label)}</span>
                      <span>{t('{value} з {target} г', { value: eaten, target: targets[k] })}</span>
                    </div>
                    <progress value={Math.min(eaten, targets[k])} max={targets[k]}
                      className={k !== 'fiber_g' && eaten > targets[k] * 1.15 ? 'over' : undefined} />
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      <section className="card red">
        <h2 style={{ marginTop: 0 }}>{t('Вода')}</h2>
        <p>
          <strong style={{ fontSize: '1.4rem' }}>
            {waterTarget
              ? t('Випито: {drunk} з {target}', { drunk: showWater(drunk), target: showWater(waterTarget) })
              : t('Випито: {drunk}', { drunk: showWater(drunk) })}
          </strong>
        </p>
        {waterTarget ? <progress className="water-bar" value={Math.min(drunk, waterTarget)} max={waterTarget} /> : null}
        {waterTarget && drunk >= waterTarget && <p className="status">{t('Норму досягнуто, чудово!')}</p>}
        {waterTarget && <p className="muted">{t('Норма води {amount}. Додайте склянку одним дотиком.', { amount: showWater(waterTarget) })}</p>}
        <div className="actions water-presets">
          {waterPresets().map((ml) => (
            <button key={ml} type="button" onClick={() => void addWater(ml)}>
              + {showMl(ml)}
            </button>
          ))}
        </div>
        {water.entries.length === 0 ? (
          <p className="muted">{t('Сьогодні води ще не записано.')}</p>
        ) : (
          <ul className="plain water-list">
            {water.entries.map((e) => (
              <li key={e.id}>
                <span className="muted">
                  {new Date(e.created_at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
                </span>
                <strong>{showMl(e.amount_ml)}</strong>
                <button type="button" aria-label={t('Видалити запис')} onClick={() => void removeWater(e)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {targets && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>{t('Ваші добові норми')}</h2>
          <div className="target-grid">
            <div><strong>{targets.protein_g} {t('г')}</strong><span>{t('Білки')}</span></div>
            <div><strong>{targets.fat_g} {t('г')}</strong><span>{t('Жири')}</span></div>
            <div><strong>{targets.carbs_g} {t('г')}</strong><span>{t('Вуглеводи')}</span></div>
            <div><strong>{targets.fiber_g} {t('г')}</strong><span>{t('Клітковина')}</span></div>
            <div><strong>{showWater(targets.water_ml)}</strong><span>{t('Вода')}</span></div>
          </div>
          <p style={{ margin: '14px 0 0' }}>
            <Link to="/profile">{t('Змінити в профілі')}</Link>
          </p>
        </section>
      )}
    </div>
  )
}
