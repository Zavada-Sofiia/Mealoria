import { useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../api/client'
import NotFound from './NotFound'

type Day = { day: string; signups: number; preorders: number }
type UserRow = {
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  provider: string | null
  has_profile: boolean
  dishes: number
  planned: number
  preordered: boolean
}
type Stats = {
  users_total: number
  users_7d: number
  preorders_total: number
  profiles_total: number
  dishes_total: number
  plan_entries_total: number
  ai_requests_today: number
  ai_users_today: number
  ai_requests_7d: number
  daily: Day[]
  users: UserRow[]
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
    : '—'

function Bars({ days, field, title }: { days: Day[]; field: 'signups' | 'preorders'; title: string }) {
  const max = Math.max(1, ...days.map((d) => d[field]))
  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="bars">
        {days.map((d) => (
          <div key={d.day} className="bar-col" title={`${d.day}: ${d[field]}`}>
            <span className="bar-num">{d[field] || ''}</span>
            <div className="bar" style={{ height: `${(d[field] / max) * 100}%` }} />
            <span className="bar-day">{d.day.slice(8)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Admin() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    apiFetch<Stats>('/api/admin/stats')
      .then((s) => current && setStats(s))
      .catch((e) => {
        if (!current) return
        if (e instanceof ApiError && e.status === 404) setDenied(true)
        else setError('Не вдалося завантажити статистику')
      })
    return () => {
      current = false
    }
  }, [version])

  // Anyone who is not an admin gets the same page as for an address that does not exist.
  if (denied) return <NotFound />

  const conversion = stats && stats.users_total ? Math.round((1000 * stats.preorders_total) / stats.users_total) / 10 : 0
  const cards: [string, string | number][] = stats
    ? [
        ['Користувачів', stats.users_total],
        ['Нових за 7 днів', stats.users_7d],
        ['Передзамовлень', stats.preorders_total],
        ['Конверсія в передзамовлення', `${conversion}%`],
        ['Заповнили профіль', stats.profiles_total],
        ['Страв створено', stats.dishes_total],
        ['Записів у календарях', stats.plan_entries_total],
        ['ШІ-запитів сьогодні', `${stats.ai_requests_today} (${stats.ai_users_today} користувачів)`],
        ['ШІ-запитів за 7 днів', stats.ai_requests_7d],
      ]
    : []

  return (
    <div>
      <h1>Для розробників</h1>
      <p className="muted">
        Дані на момент завантаження.{' '}
        <button onClick={() => setVersion((v) => v + 1)}>Оновити</button>
      </p>
      {error && <p className="status">{error}</p>}
      {!stats && !error && <p className="status">Завантаження…</p>}

      {stats && (
        <>
          <div className="grid" style={{ marginBottom: 20 }}>
            {cards.map(([label, value]) => (
              <section key={label} className="card" style={{ padding: 16 }}>
                <div className="muted">{label}</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>{value}</div>
              </section>
            ))}
          </div>

          <div className="grid" style={{ marginBottom: 20 }}>
            <Bars days={stats.daily} field="signups" title="Реєстрації за 14 днів" />
            <Bars days={stats.daily} field="preorders" title="Передзамовлення за 14 днів" />
          </div>

          <section className="card red">
            <h3>Користувачі (останні 200)</h3>
            <div className="week-scroll" style={{ boxShadow: 'none' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Вхід</th>
                    <th>Реєстрація</th>
                    <th>Остання активність</th>
                    <th>Профіль</th>
                    <th>Страв</th>
                    <th>У календарі</th>
                    <th>Передзамовив</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.users.map((u) => (
                    <tr key={`${u.email}-${u.created_at}`}>
                      <td>{u.email ?? '—'}</td>
                      <td>{u.provider ?? '—'}</td>
                      <td>{fmt(u.created_at)}</td>
                      <td>{fmt(u.last_sign_in_at)}</td>
                      <td>{u.has_profile ? '✓' : ''}</td>
                      <td>{u.dishes}</td>
                      <td>{u.planned}</td>
                      <td>{u.preordered ? '✓' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
