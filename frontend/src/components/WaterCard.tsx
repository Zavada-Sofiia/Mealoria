import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { locale, t } from '../i18n'
import { showMl, showWater, waterPresets } from '../units'

type WaterEntry = { id: string; amount_ml: number; created_at: string }
type WaterDay = { total_ml: number; entries: WaterEntry[] }

/** Water for one day: a glass is added with one tap. "compact" leaves out the list, for the Today page. */
export default function WaterCard({ day, target, compact = false }: { day: string; target: number | null; compact?: boolean }) {
  const [water, setWater] = useState<WaterDay>({ total_ml: 0, entries: [] })
  const [status, setStatus] = useState('')

  useEffect(() => {
    let current = true
    apiFetch<WaterDay>(`/api/water?day=${day}`)
      .then((w) => {
        if (!current) return
        setWater(w)
        setStatus('')
      })
      .catch(() => current && setStatus(t('Не вдалося завантажити дані')))
    return () => {
      current = false
    }
  }, [day])

  /** The glass appears at once and is saved in the background. */
  async function addWater(ml: number) {
    const temp: WaterEntry = { id: `tmp-${Date.now()}`, amount_ml: ml, created_at: new Date().toISOString() }
    setWater((w) => ({ total_ml: w.total_ml + ml, entries: [...w.entries, temp] }))
    try {
      const saved = await apiFetch<WaterEntry>('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, amount_ml: ml }),
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
  return (
    <section className="card red" id="cal-water">
      <h3 style={{ marginTop: 0 }}>{t('Вода')}</h3>
      <p>
        <strong style={{ fontSize: compact ? '1.6rem' : '1.4rem' }}>
          {target
            ? t('Випито: {drunk} з {target}', { drunk: showWater(drunk), target: showWater(target) })
            : t('Випито: {drunk}', { drunk: showWater(drunk) })}
        </strong>
      </p>
      {target ? <progress className="water-bar" value={Math.min(drunk, target)} max={target} /> : null}
      {target && drunk >= target && <p className="status">{t('Норму досягнуто, чудово!')}</p>}
      {status && <p className="status">{status}</p>}
      <div className="actions water-presets">
        {waterPresets().map((ml) => (
          <button key={ml} type="button" onClick={() => void addWater(ml)}>
            + {showMl(ml)}
          </button>
        ))}
      </div>
      {!compact &&
        (water.entries.length === 0 ? (
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
        ))}
    </section>
  )
}
