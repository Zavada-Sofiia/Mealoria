import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../api/client'
import { BarChart, LineChart } from '../components/Charts'
import MealPhotoCard from '../components/MealPhotoCard'
import SectionRail from '../components/SectionRail'
import { addDays, fmtDate, fmtShortDate, iso } from '../dates'
import { t } from '../i18n'
import { targetsFromProfile, type Targets } from '../nutrition'
import { energyUnit, showEnergy } from '../units'
import { gramUnit, showGrams, showWater, showWeight, storeGrams, storeWeight, weightUnit } from '../units'
import { macrosLine } from '../macros'

type Macros = { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number }
type DayResponse = {
  target: number | null
  total: Macros
  meals: { slot: number; kcal: number; dishes: string[] }[]
}
type Food = {
  name: string
  kcal_100g: number
  protein_100g: number
  fat_100g: number
  carbs_100g: number
  fiber_100g?: number
}
type Line = Food & { grams: number }

const round = (n: number) => Math.round(n * 10) / 10

function DaySummary() {
  const [date, setDate] = useState(() => new Date())
  const [data, setData] = useState<DayResponse | null>(null)
  const [status, setStatus] = useState(t('Завантаження…'))
  const [targets, setTargets] = useState<Targets | null>(null)
  const day = iso(date)

  useEffect(() => {
    apiFetch<Parameters<typeof targetsFromProfile>[0]>('/api/profile')
      .then((r) => setTargets(targetsFromProfile(r)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let current = true
    apiFetch<DayResponse>(`/api/calories/day?date=${day}`)
      .then((r) => {
        if (!current) return
        setData(r)
        setStatus('')
      })
      .catch(() => current && setStatus(t('Не вдалося завантажити день')))
    return () => {
      current = false
    }
  }, [day])

  function goTo(d: Date) {
    setStatus(t('Завантаження…'))
    setDate(d)
  }

  const total = data?.total.kcal ?? 0
  const target = data?.target
  const diff = target ? Math.round(total - target) : null

  return (
    <section className="card" id="cal-day">
      <h2 style={{ marginTop: 0 }}>{t('День')}</h2>
      <div className="week-nav">
        <button onClick={() => goTo(addDays(date, -1))}>←</button>
        <input type="date" value={day} onChange={(e) => e.target.value && goTo(new Date(e.target.value + 'T00:00'))} />
        <button onClick={() => goTo(addDays(date, 1))}>→</button>
      </div>
      {status && <p className="status">{status}</p>}
      {data && (
        <>
          <p>
            <strong>{showEnergy(total)}</strong>
            {target ? ` / ${showEnergy(target)} ${energyUnit()}` : t(' {unit} (задайте ціль у профілі)', { unit: energyUnit() })}
          </p>
          {target ? (
            <progress className={total > target ? 'over' : undefined} value={Math.min(total, target)} max={target} />
          ) : null}
          {diff !== null && (
            <p>{diff > 0 ? t('Перевищення на {n} {unit}', { n: showEnergy(diff), unit: energyUnit() }) : t('Залишилось {n} {unit}', { n: showEnergy(-diff), unit: energyUnit() })}</p>
          )}
          {!targets && (
            <p>
              {t('Білки {p} г · Жири {f} г · Вуглеводи {c} г · Клітковина {k} г', { p: data.total.protein_g, f: data.total.fat_g, c: data.total.carbs_g, k: data.total.fiber_g ?? 0 })}
            </p>
          )}
          {targets && (
            <div className="nutrients">
              {(
                [
                  ['Білки', 'protein_g'],
                  ['Жири', 'fat_g'],
                  ['Вуглеводи', 'carbs_g'],
                  ['Клітковина', 'fiber_g'],
                ] as const
              ).map(([label, key]) => {
                const eaten = data.total[key] ?? 0
                return (
                  <div key={key}>
                    <div className="nutrient-head">
                      <span>{t(label)}</span>
                      <span>{t('{value} з {target} г', { value: eaten, target: targets[key] })}</span>
                    </div>
                    <progress value={Math.min(eaten, targets[key])} max={targets[key]}
                      className={key !== 'fiber_g' && eaten > targets[key] * 1.15 ? 'over' : undefined} />
                  </div>
                )
              })}
              <p className="muted" style={{ margin: '4px 0 0' }}>{t('Норма води: {amount}', { amount: showWater(targets.water_ml) })}</p>
            </div>
          )}
          {data.meals.length === 0 ? (
            <p>{t('На цей день у календарі немає страв.')}</p>
          ) : (
            <ul>
              {data.meals.map((m) => (
                <li key={m.slot}>
                  {t('{n}: {kcal} {unit} — {dishes}', { n: t('Прийом {n}', { n: m.slot + 1 }), kcal: showEnergy(m.kcal), unit: energyUnit(), dishes: m.dishes.join(', ') })}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function DishCalculator() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [servings, setServings] = useState(1)
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')

  async function search(e: FormEvent) {
    e.preventDefault()
    if (query.trim().length < 2) return
    setStatus(t('Шукаємо…'))
    try {
      const r = await apiFetch<Food[]>(`/api/calories/food?q=${encodeURIComponent(query)}`)
      setResults(r)
      setStatus(r.length ? '' : t('Нічого не знайдено. Спробуйте іншу назву українською'))
    } catch {
      setStatus(t('База продуктів зараз недоступна, спробуйте за хвилину'))
    }
  }

  const sum = (pick: (l: Line) => number) =>
    round(lines.reduce((s, l) => s + (pick(l) * l.grams) / 100, 0) / servings)
  const kcal = Math.round(sum((l) => l.kcal_100g))
  const protein = sum((l) => l.protein_100g)
  const fat = sum((l) => l.fat_100g)
  const carbs = sum((l) => l.carbs_100g)
  const fiber = sum((l) => l.fiber_100g ?? 0)

  async function saveDish() {
    if (!name.trim() || lines.length === 0) return
    try {
      await apiFetch('/api/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          calories: kcal,
          protein_g: protein,
          fat_g: fat,
          carbs_g: carbs,
          fiber_g: fiber || null,
          servings,
          ingredients: lines.map((l) => ({ name: l.name.slice(0, 100), amount: `${l.grams} ${t('г')}` })),
        }),
      })
      setLines([])
      setName('')
      setServings(1)
      setStatus(t('Страву збережено в «Мої страви»'))
    } catch {
      setStatus(t('Не вдалося зберегти страву'))
    }
  }

  return (
    <section className="card red" id="cal-trend">
      <h2 style={{ marginTop: 0 }}>{t('Калькулятор страви')}</h2>
      <form onSubmit={search} className="actions" style={{ marginBottom: 12 }}>
        <input placeholder={t('Продукт, наприклад гречка')} value={query} style={{ maxWidth: 320 }}
          onChange={(e) => setQuery(e.target.value)} />
        <button type="submit">{t('Знайти')}</button>
      </form>
      {status && <p className="status">{status}</p>}

      <ul className="cards">
        {results.map((f) => (
          <li key={f.name}>
            {t('{name} · {n} {unit} / 100 г', { name: f.name, n: showEnergy(f.kcal_100g), unit: energyUnit() })}{' '}
            <button onClick={() => setLines([...lines, { ...f, grams: 100 }])}>{t('Додати')}</button>
          </li>
        ))}
      </ul>

      {lines.length > 0 && (
        <>
          <h3>{t('Склад')}</h3>
          <ul className="cards">
            {lines.map((l, i) => (
              <li key={i}>
                {l.name}{' '}
                <input type="number" min={0} max={showGrams(5000)} step="any" value={showGrams(l.grams)} style={{ width: 80 }}
                  onChange={(e) =>
                    setLines(lines.map((x, j) => (j === i ? { ...x, grams: storeGrams(Number(e.target.value)) } : x)))
                  } />{' '}
                {gramUnit()} <button onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
          <p>
            {t('Порцій:')}{' '}
            <input type="number" min={1} max={50} value={servings} style={{ width: 60 }}
              onChange={(e) => setServings(Math.max(1, Number(e.target.value)))} />
          </p>
          <p>
            {t('На порцію:')} <strong>{showEnergy(kcal)} {energyUnit()}</strong> · {macrosLine(protein, fat, carbs, fiber)}
          </p>
          <p>
            <input placeholder={t('Назва страви')} value={name} maxLength={100}
              onChange={(e) => setName(e.target.value)} />{' '}
            <button onClick={saveDish}>{t('Зберегти як страву')}</button>
          </p>
        </>
      )}
      <p>
        <small>
          {t('Дані про продукти з Open Food Facts, показуємо лише українські назви. Значення можуть бути неточними.')}
        </small>
      </p>
    </section>
  )
}

type RangeResponse = { target: number | null; days: ({ date: string } & Macros)[] }

function Trends() {
  const [span, setSpan] = useState(7)
  const [data, setData] = useState<RangeResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    const end = new Date()
    apiFetch<RangeResponse>(`/api/calories/range?start=${iso(addDays(end, 1 - span))}&end=${iso(end)}`)
      .then((r) => current && (setData(r), setFailed(false)))
      .catch(() => current && setFailed(true))
    return () => {
      current = false
    }
  }, [span])

  const planned = data?.days.filter((d) => d.kcal > 0) ?? []
  const average = planned.length ? Math.round(planned.reduce((s, d) => s + d.kcal, 0) / planned.length) : 0

  return (
    <section className="card" id="cal-weight">
      <h2 style={{ marginTop: 0 }}>{t('Динаміка калорій')}</h2>
      <div className="seg">
        {[7, 30].map((n) => (
          <button key={n} type="button" className={span === n ? 'on' : ''} onClick={() => setSpan(n)}>
            {t('{n} днів', { n })}
          </button>
        ))}
      </div>
      {failed && <p className="status">{t('Не вдалося завантажити дані')}</p>}
      {data && (
        <>
          <BarChart
            bars={data.days.map((d) => ({ label: fmtShortDate(d.date), value: showEnergy(d.kcal) }))}
            target={data.target ? showEnergy(data.target) : data.target}
          />
          <p className="muted">
            {planned.length
              ? t('У середньому {avg} {unit} на день із запланованих ({days} дн.)', { avg: showEnergy(average), unit: energyUnit(), days: planned.length })
              : t('У цьому періоді немає запланованих страв.')}
            {data.target ? t(' Пунктир: ваша норма {n} {unit}.', { n: showEnergy(data.target), unit: energyUnit() }) : ''}
          </p>
        </>
      )}
    </section>
  )
}

type WeightPoint = { day: string; weight_kg: number }

function WeightJournal() {
  const [points, setPoints] = useState<WeightPoint[]>([])
  const [today] = useState(() => iso(new Date()))
  const [day, setDay] = useState(today)
  const [weight, setWeight] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    apiFetch<WeightPoint[]>('/api/weight')
      .then(setPoints)
      .catch(() => setStatus(t('Не вдалося завантажити журнал ваги')))
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    const value = Number(weight.replace(',', '.'))
    const kg = storeWeight(value)
    if (!(kg >= 20 && kg <= 400))
      return setStatus(t('Вкажіть вагу від {min} до {max} {unit}', { min: showWeight(20), max: showWeight(400), unit: weightUnit() }))
    try {
      const saved = await apiFetch<WeightPoint>('/api/weight', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, weight_kg: kg }),
      })
      setPoints((ps) => [...ps.filter((p) => p.day !== saved.day), saved].sort((a, b) => a.day.localeCompare(b.day)))
      setWeight('')
      setStatus(t('Збережено'))
    } catch {
      setStatus(t('Не вдалося зберегти'))
    }
  }

  async function remove(d: string) {
    try {
      await apiFetch<void>(`/api/weight/${d}`, { method: 'DELETE' })
      setPoints((ps) => ps.filter((p) => p.day !== d))
    } catch {
      setStatus(t('Не вдалося видалити'))
    }
  }

  const first = points[0]
  const last = points[points.length - 1]
  const change = first && last && first !== last ? Math.round((showWeight(last.weight_kg) - showWeight(first.weight_kg)) * 10) / 10 : null

  return (
    <section className="card red" id="cal-calc">
      <h2 style={{ marginTop: 0 }}>{t('Журнал ваги')}</h2>
      <form onSubmit={save} className="actions" style={{ marginBottom: 12 }}>
        <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <input inputMode="decimal" placeholder={`${t('Вага')}, ${weightUnit()}`} value={weight} style={{ maxWidth: 120 }}
          onChange={(e) => setWeight(e.target.value)} />
        <button type="submit">{t('Записати')}</button>
      </form>
      {status && <p className="status">{status}</p>}
      {points.length >= 2 && (
        <LineChart points={points.map((p) => ({ label: fmtShortDate(p.day), value: showWeight(p.weight_kg) }))} />
      )}
      {points.length === 1 && <p className="muted">{t('Додайте ще один запис, щоб побачити графік.')}</p>}
      {change !== null && (
        <p className="muted">
          {t('Зміна з {date}:', { date: fmtDate(first.day) })} {change > 0 ? '+' : ''}
          {change} {weightUnit()}
        </p>
      )}
      {points.length > 0 && (
        <details>
          <summary>{t('Усі записи ({n})', { n: points.length })}</summary>
          <ul className="cards">
            {[...points].reverse().map((p) => (
              <li key={p.day}>
                {fmtDate(p.day)}: <strong>{showWeight(p.weight_kg)} {weightUnit()}</strong>{' '}
                <button type="button" onClick={() => remove(p.day)} aria-label={t('Видалити запис')}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

const RAIL = [
  { id: 'cal-day', label: 'День' },
  { id: 'cal-trend', label: 'Динаміка' },
  { id: 'cal-weight', label: 'Вага' },
  { id: 'cal-photo', label: 'По фото' },
  { id: 'cal-calc', label: 'Калькулятор' },
]

export default function Calories() {
  return (
    <div>
      <h1>{t('Калорії')}</h1>
      <SectionRail items={RAIL} />
      <DaySummary />
      <Trends />
      <WeightJournal />
      <MealPhotoCard />
      <DishCalculator />
    </div>
  )
}
