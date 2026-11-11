import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../api/client'
import { BarChart, LineChart } from '../components/Charts'
import { addDays, fmtDate, iso } from '../dates'
import { t } from '../i18n'

type Macros = { kcal: number; protein_g: number; fat_g: number; carbs_g: number }
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
}
type Line = Food & { grams: number }

const round = (n: number) => Math.round(n * 10) / 10

function DaySummary() {
  const [date, setDate] = useState(() => new Date())
  const [data, setData] = useState<DayResponse | null>(null)
  const [status, setStatus] = useState(t('Завантаження…'))
  const day = iso(date)

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
    <section className="card">
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
            <strong>{Math.round(total)}</strong>
            {target ? ` / ${target} ${t('ккал')}` : t(' ккал (задайте ціль у профілі)')}
          </p>
          {target ? (
            <progress className={total > target ? 'over' : undefined} value={Math.min(total, target)} max={target} />
          ) : null}
          {diff !== null && (
            <p>{diff > 0 ? t('Перевищення на {n} ккал', { n: diff }) : t('Залишилось {n} ккал', { n: -diff })}</p>
          )}
          <p>
            {t('Білки {p} г · Жири {f} г · Вуглеводи {c} г', { p: data.total.protein_g, f: data.total.fat_g, c: data.total.carbs_g })}
          </p>
          {data.meals.length === 0 ? (
            <p>{t('На цей день у календарі немає страв.')}</p>
          ) : (
            <ul>
              {data.meals.map((m) => (
                <li key={m.slot}>
                  {t('{n}: {kcal} ккал — {dishes}', { n: t('Прийом {n}', { n: m.slot + 1 }), kcal: Math.round(m.kcal), dishes: m.dishes.join(', ') })}
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
    <section className="card red">
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
            {t('{name} · {n} ккал / 100 г', { name: f.name, n: f.kcal_100g })}{' '}
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
                <input type="number" min={1} max={5000} value={l.grams} style={{ width: 80 }}
                  onChange={(e) =>
                    setLines(lines.map((x, j) => (j === i ? { ...x, grams: Number(e.target.value) } : x)))
                  } />{' '}
                {t('г')} <button onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
          <p>
            {t('Порцій:')}{' '}
            <input type="number" min={1} max={50} value={servings} style={{ width: 60 }}
              onChange={(e) => setServings(Math.max(1, Number(e.target.value)))} />
          </p>
          <p>
            {t('На порцію:')} <strong>{kcal} {t('ккал')}</strong> · {t('Б {p} · Ж {f} · В {c} г', { p: protein, f: fat, c: carbs })}
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
const shortDate = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`

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
    <section className="card">
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
            bars={data.days.map((d) => ({ label: shortDate(d.date), value: Math.round(d.kcal) }))}
            target={data.target}
          />
          <p className="muted">
            {planned.length
              ? t('У середньому {avg} ккал на день із запланованих ({days} дн.)', { avg: average, days: planned.length })
              : t('У цьому періоді немає запланованих страв.')}
            {data.target ? t(' Пунктир: ваша норма {n} ккал.', { n: data.target }) : ''}
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
    if (!(value >= 20 && value <= 400)) return setStatus(t('Вкажіть вагу від 20 до 400 кг'))
    try {
      const saved = await apiFetch<WeightPoint>('/api/weight', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, weight_kg: value }),
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
  const change = first && last && first !== last ? Math.round((last.weight_kg - first.weight_kg) * 10) / 10 : null

  return (
    <section className="card red">
      <h2 style={{ marginTop: 0 }}>{t('Журнал ваги')}</h2>
      <form onSubmit={save} className="actions" style={{ marginBottom: 12 }}>
        <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <input inputMode="decimal" placeholder={t('Вага, кг')} value={weight} style={{ maxWidth: 120 }}
          onChange={(e) => setWeight(e.target.value)} />
        <button type="submit">{t('Записати')}</button>
      </form>
      {status && <p className="status">{status}</p>}
      {points.length >= 2 && (
        <LineChart points={points.map((p) => ({ label: shortDate(p.day), value: p.weight_kg }))} />
      )}
      {points.length === 1 && <p className="muted">{t('Додайте ще один запис, щоб побачити графік.')}</p>}
      {change !== null && (
        <p className="muted">
          {t('Зміна з {date}:', { date: fmtDate(first.day) })} {change > 0 ? '+' : ''}
          {change} {t('кг')}
        </p>
      )}
      {points.length > 0 && (
        <details>
          <summary>{t('Усі записи ({n})', { n: points.length })}</summary>
          <ul className="cards">
            {[...points].reverse().map((p) => (
              <li key={p.day}>
                {fmtDate(p.day)}: <strong>{p.weight_kg} {t('кг')}</strong>{' '}
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

export default function Calories() {
  return (
    <div>
      <h1>{t('Калорії')}</h1>
      <DaySummary />
      <Trends />
      <WeightJournal />
      <DishCalculator />
    </div>
  )
}
