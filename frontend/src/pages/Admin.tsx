import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, apiFetch } from '../api/client'
import NotFound from './NotFound'
import { reportError } from '../monitoring'
import { askConfirm } from '../confirm'

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
type Promo = { code: string; days: number; max_uses: number | null; used_count: number; created_at: string }
type PremiumUser = { email: string; premium_until: string | null; active: boolean }
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
          <div key={d.day} className="bar-col" title={`${d.day.split('-').reverse().join('.')}: ${d[field]}`}>
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
  const [premium, setPremium] = useState<PremiumUser[]>([])
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState('premium')
  const [days, setDays] = useState('30')
  const [planMessage, setPlanMessage] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [promos, setPromos] = useState<Promo[]>([])
  const [promoCode, setPromoCode] = useState('')
  const [promoDays, setPromoDays] = useState('30')
  const [promoUses, setPromoUses] = useState('1')
  const [promoMessage, setPromoMessage] = useState('')
  const [created, setCreated] = useState('')

  useEffect(() => {
    let current = true
    apiFetch<Stats>('/api/admin/stats')
      .then((s) => current && setStats(s))
      .catch((e) => {
        if (!current) return
        if (e instanceof ApiError && e.status === 404) setDenied(true)
        else setError('Не вдалося завантажити статистику')
      })
    // a failure here (for example, the plans SQL is not applied yet) must not hide the stats
    apiFetch<PremiumUser[]>('/api/admin/premium')
      .then((p) => current && setPremium(p))
      .catch(() => {})
    apiFetch<Promo[]>('/api/admin/promos')
      .then((p) => current && setPromos(p))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [version])

  async function testMonitoring() {
    reportError(new Error('Sentry test error from the Mealoria website'))
    try {
      await apiFetch('/api/admin/sentry-test', { method: 'POST' })
    } catch {
      // the backend answers with an error on purpose
    }
    setTestMessage('Тестові помилки надіслано (сайт і сервер). Перевірте Sentry за хвилину.')
  }

  async function createPromo(e: FormEvent) {
    e.preventDefault()
    setPromoMessage('')
    setCreated('')
    try {
      const r = await apiFetch<{ code: string }>('/api/admin/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode.trim(),
          days: Number(promoDays),
          max_uses: promoUses.trim() === '' ? null : Number(promoUses),
        }),
      })
      setCreated(r.code)
      setPromoCode('')
      setVersion((v) => v + 1)
    } catch (err) {
      setPromoMessage(
        err instanceof ApiError && err.status === 409
          ? 'Такий код уже існує'
          : err instanceof ApiError && err.status === 422
            ? 'Перевірте код (літери, цифри, - і _; 3–40 символів) і кількість днів'
            : 'Не вдалося створити промокод',
      )
    }
  }

  async function deletePromo(code: string) {
    const ok = await askConfirm({
      title: `Видалити промокод ${code}?`,
      text: 'Хто вже активував його, лишиться з преміумом, але нові активації стануть неможливі.',
      confirmLabel: 'Видалити',
      cancelLabel: 'Скасувати',
      danger: true,
    })
    if (!ok) return
    try {
      await apiFetch<void>(`/api/admin/promo/${encodeURIComponent(code)}`, { method: 'DELETE' })
      setVersion((v) => v + 1)
    } catch {
      setPromoMessage('Не вдалося видалити')
    }
  }

  async function changePlan(e: FormEvent) {
    e.preventDefault()
    setPlanMessage('')
    try {
      await apiFetch('/api/admin/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          plan,
          days: plan === 'premium' && days ? Number(days) : null,
        }),
      })
      setPlanMessage(plan === 'premium' ? 'Преміум видано' : 'Користувача повернуто на безкоштовний тариф')
      setVersion((v) => v + 1)
    } catch (err) {
      setPlanMessage(
        err instanceof ApiError && err.detail === 'user_not_found'
          ? 'Користувача з такою поштою не знайдено (він має хоч раз увійти на сайт)'
          : 'Не вдалося змінити тариф',
      )
    }
  }

  // Anyone who is not an admin gets the same page as for an address that does not exist.
  if (denied) return <NotFound />

  const conversion = stats && stats.users_total ? Math.round((1000 * stats.preorders_total) / stats.users_total) / 10 : 0
  const cards: [string, string | number][] = stats
    ? [
        ['Користувачів', stats.users_total],
        ['Нових за 7 днів', stats.users_7d],
        ['Преміум-користувачів', premium.filter((p) => p.active).length],
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

          <section className="card">
            <h3>Моніторинг помилок (Sentry)</h3>
            <p className="muted">
              Надсилає по одній тестовій помилці з сайту й із сервера, щоб перевірити, що Sentry їх
              отримує.
            </p>
            <button onClick={testMonitoring}>Надіслати тестову помилку</button>
            {testMessage && <p className="status" style={{ marginTop: 12 }}>{testMessage}</p>}
          </section>

          <section className="card">
            <h3>Тарифи користувачів</h3>
            <form onSubmit={changePlan}>
              <div className="row">
                <label>
                  Email користувача
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                  Тариф
                  <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                    <option value="premium">Преміум</option>
                    <option value="free">Безкоштовний</option>
                  </select>
                </label>
                {plan === 'premium' && (
                  <label>
                    Днів (порожньо = безстроково)
                    <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} />
                  </label>
                )}
              </div>
              <button type="submit">Застосувати</button>
              {planMessage && <span className="muted"> {planMessage}</span>}
            </form>
            {premium.length > 0 && (
              <div className="week-scroll" style={{ boxShadow: 'none', marginTop: 16 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Діє до</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {premium.map((p) => (
                      <tr key={p.email}>
                        <td>{p.email}</td>
                        <td>{p.premium_until ? fmt(p.premium_until) : 'безстроково'}</td>
                        <td>{p.active ? 'діє' : 'закінчився'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Промокоди</h3>
            <p className="muted">
              Код дає преміум на вказану кількість днів і додається до того, що в людини вже є. Людина вводить його на
              сторінці «Тарифи». Залиште поле коду порожнім, і він згенерується сам.
            </p>
            <form onSubmit={createPromo}>
              <div className="row">
                <label>
                  Код (необов’язково)
                  <input value={promoCode} maxLength={40} placeholder="наприклад, FRIENDS30"
                    style={{ textTransform: 'uppercase' }} onChange={(e) => setPromoCode(e.target.value)} />
                </label>
                <label>
                  На скільки днів
                  <input type="number" min={1} max={3650} required value={promoDays} onChange={(e) => setPromoDays(e.target.value)} />
                </label>
                <label>
                  Скільки активацій (порожньо = без обмежень)
                  <input type="number" min={1} max={100000} value={promoUses} onChange={(e) => setPromoUses(e.target.value)} />
                </label>
              </div>
              <button type="submit">Створити промокод</button>
              {promoMessage && <span className="muted"> {promoMessage}</span>}
            </form>
            {created && (
              <p className="status" style={{ marginTop: 14 }}>
                Створено: <strong style={{ fontSize: '1.2rem', letterSpacing: '0.05em' }}>{created}</strong>{' '}
                <button type="button" onClick={() => void navigator.clipboard?.writeText(created)}>Копіювати</button>
              </p>
            )}
            {promos.length > 0 && (
              <div className="week-scroll" style={{ boxShadow: 'none', marginTop: 16 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Днів</th>
                      <th>Активовано</th>
                      <th>Створено</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {promos.map((p) => (
                      <tr key={p.code}>
                        <td><strong>{p.code}</strong></td>
                        <td>{p.days}</td>
                        <td>
                          {p.used_count} / {p.max_uses ?? '∞'}
                        </td>
                        <td>{fmt(p.created_at)}</td>
                        <td>
                          <button type="button" className="danger" onClick={() => void deletePromo(p.code)}>Видалити</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
