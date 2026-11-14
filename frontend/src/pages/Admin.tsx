import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { API_URL, ApiError, apiFetch } from '../api/client'
import NotFound from './NotFound'
import { reportError } from '../monitoring'
import { askConfirm } from '../confirm'
import SectionRail from '../components/SectionRail'
import { NoticeBar } from '../components/NoticeBanner'
import { fetchNotice } from '../notice'

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
type Promo = {
  code: string
  days: number
  max_uses: number | null
  used_count: number
  created_at: string
  message_uk?: string | null
  message_en?: string | null
}
type Grant = {
  email: string | null
  source: 'admin' | 'promo' | 'reset' | 'card'
  months: number
  days: number
  unlimited: boolean
  note: string
  was_active: boolean
  previous_until: string | null
  new_until: string | null
  granted_at: string
}
type PayOrder = {
  email: string | null
  code: string
  months: number
  amount_uah: number
  status: 'pending' | 'paid' | 'cancelled'
  paid_by: 'auto' | 'admin' | null
  created_at: string
  paid_at: string | null
}
type PayStatus = {
  secret_set: boolean
  pending: number
  paid: number
  paid_uah: number
  card_set: boolean
  secret_in_environment: boolean
  secret_matches: boolean
  bank_check: boolean
  orders: PayOrder[]
}
const randomSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
type FeedbackItem = {
  id: string
  email: string | null
  category: 'bug' | 'idea' | 'question' | 'other'
  message: string
  page: string
  status: 'new' | 'done'
  created_at: string
}
const FEEDBACK_KINDS = { bug: 'Щось не працює', idea: 'Ідея', question: 'Питання', other: 'Інше' }
type PreorderCount = { months: number | null; count: number }
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

const grantLabel = (g: Grant) =>
  g.source === 'reset'
    ? '—'
    : g.months && g.days
      ? `${g.months} міс + ${g.days} дн`
      : g.months
        ? g.months === 12
          ? '1 рік'
          : `${g.months} міс`
        : g.days
          ? `${g.days} дн`
          : 'безстроково'

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

const RAIL = [
  { id: 'adm-stats', label: 'Огляд' },
  { id: 'adm-charts', label: 'Графіки' },
  { id: 'adm-notice', label: 'Оголошення' },
  { id: 'adm-sentry', label: 'Помилки (Sentry)' },
  { id: 'adm-plans', label: 'Преміум' },
  { id: 'adm-promo', label: 'Промокоди' },
  { id: 'adm-pay', label: 'Оплата карткою' },
  { id: 'adm-feedback', label: 'Відгуки' },
  { id: 'adm-users', label: 'Користувачі' },
]

export default function Admin() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [premium, setPremium] = useState<PremiumUser[]>([])
  const [email, setEmail] = useState('')
  const [period, setPeriod] = useState('3')
  const [days, setDays] = useState('30')
  const [grants, setGrants] = useState<Grant[]>([])
  const [preorders, setPreorders] = useState<PreorderCount[]>([])
  const [planMessage, setPlanMessage] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [promos, setPromos] = useState<Promo[]>([])
  const [promoCode, setPromoCode] = useState('')
  const [promoDays, setPromoDays] = useState('30')
  const [promoUses, setPromoUses] = useState('1')
  // the text shown after this code is redeemed (optional), and the code whose text is being edited
  const [promoMsgUk, setPromoMsgUk] = useState('')
  const [promoMsgEn, setPromoMsgEn] = useState('')
  const [editingPromo, setEditingPromo] = useState<string | null>(null)
  const [editUk, setEditUk] = useState('')
  const [editEn, setEditEn] = useState('')
  const [promoMessage, setPromoMessage] = useState('')
  const [created, setCreated] = useState('')
  const [pay, setPay] = useState<PayStatus | null>(null)
  const [feedback, setFeedback] = useState<{ new_count: number; items: FeedbackItem[] } | null>(null)
  const [newSecret, setNewSecret] = useState('')
  const [payMessage, setPayMessage] = useState('')
  const [noticeOn, setNoticeOn] = useState(false)
  const [noticeLevel, setNoticeLevel] = useState<'info' | 'warning'>('warning')
  const [noticeUk, setNoticeUk] = useState('')
  const [noticeEn, setNoticeEn] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')

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
    apiFetch<Grant[]>('/api/admin/premium/history')
      .then((g) => current && setGrants(g))
      .catch(() => {})
    apiFetch<PreorderCount[]>('/api/admin/preorders')
      .then((p) => current && setPreorders(p))
      .catch(() => {})
    apiFetch<Promo[]>('/api/admin/promos')
      .then((p) => current && setPromos(p))
      .catch(() => {})
    apiFetch<PayStatus>('/api/admin/payments')
      .then((p) => current && setPay(p))
      .catch(() => {})
    apiFetch<{ new_count: number; items: FeedbackItem[] }>('/api/admin/feedback')
      .then((f) => current && setFeedback(f))
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

  // fill the form with the notice that is on the site now
  useEffect(() => {
    void fetchNotice().then((n) => {
      if (!n) return
      setNoticeOn(n.active)
      setNoticeLevel(n.level)
      setNoticeUk(n.message_uk)
      setNoticeEn(n.message_en)
    })
  }, [])

  async function saveNotice(e: FormEvent) {
    e.preventDefault()
    setNoticeMessage('')
    try {
      await apiFetch('/api/admin/notice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: noticeOn, level: noticeLevel, message_uk: noticeUk, message_en: noticeEn }),
      })
      setNoticeMessage(noticeOn ? 'Збережено: оголошення зараз видно всім на сайті' : 'Збережено: оголошення вимкнено')
    } catch (err) {
      setNoticeMessage(
        err instanceof ApiError && err.detail === 'message_required'
          ? 'Напишіть текст оголошення, перш ніж його вмикати'
          : 'Не вдалося зберегти',
      )
    }
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
          message_uk: promoMsgUk,
          message_en: promoMsgEn,
        }),
      })
      setCreated(r.code)
      setPromoCode('')
      setPromoMsgUk('')
      setPromoMsgEn('')
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

  function startEditing(p: Promo) {
    setEditingPromo(p.code)
    setEditUk(p.message_uk ?? '')
    setEditEn(p.message_en ?? '')
  }

  async function savePromoMessage(code: string) {
    try {
      await apiFetch(`/api/admin/promo/${encodeURIComponent(code)}/message`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_uk: editUk, message_en: editEn }),
      })
      setPromos((list) =>
        list.map((p) => (p.code === code ? { ...p, message_uk: editUk.trim() || null, message_en: editEn.trim() || null } : p)),
      )
      setEditingPromo(null)
    } catch {
      setPromoMessage('Не вдалося зберегти повідомлення')
    }
  }

  async function setFeedbackStatus(item: FeedbackItem, status: 'new' | 'done') {
    setFeedback((f) =>
      f && {
        new_count: f.new_count + (status === 'new' ? 1 : -1) * (item.status === status ? 0 : 1),
        items: f.items.map((x) => (x.id === item.id ? { ...x, status } : x)),
      },
    )
    try {
      await apiFetch(`/api/admin/feedback/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } catch {
      setVersion((v) => v + 1) // show what is really saved
    }
  }

  async function makeSecret() {
    if (
      pay?.secret_set &&
      !(await askConfirm({
        title: 'Створити новий секрет?',
        text: 'Старий перестане діяти: його треба буде замінити в Render і заново зареєструвати адресу в monobank.',
        confirmLabel: 'Створити',
        cancelLabel: 'Скасувати',
        danger: true,
      }))
    )
      return
    const secret = randomSecret()
    try {
      await apiFetch('/api/admin/payments/secret', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })
      setNewSecret(secret)
      setPayMessage('')
      setVersion((v) => v + 1)
    } catch {
      setPayMessage('Не вдалося зберегти секрет. Спробуйте ще раз.')
    }
  }

  async function confirmOrder(o: PayOrder) {
    const ok = await askConfirm({
      title: `Гроші за ${o.code} справді надійшли?`,
      text: `${o.amount_uah} грн, ${o.email ?? '—'}, ${o.months} міс. Преміум буде додано одразу.`,
      confirmLabel: 'Так, підтвердити',
      cancelLabel: 'Ні',
    })
    if (!ok) return
    try {
      await apiFetch(`/api/admin/payments/orders/${o.code}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'підтверджено вручну' }),
      })
      setPayMessage(`Замовлення ${o.code} підтверджено, преміум додано.`)
      setVersion((v) => v + 1)
    } catch {
      setPayMessage('Не вдалося підтвердити замовлення.')
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

  async function grantPremium(e: FormEvent) {
    e.preventDefault()
    setPlanMessage('')
    const body =
      period === 'unlimited'
        ? { email: email.trim(), unlimited: true }
        : period === 'days'
          ? { email: email.trim(), days: Number(days) }
          : { email: email.trim(), months: Number(period) }
    try {
      const r = await apiFetch<{ was_active: boolean; previous_until: string | null; new_until: string | null; unlimited: boolean }>(
        '/api/admin/premium/grant',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      )
      setPlanMessage(
        r.unlimited
          ? 'Готово: преміум безстроковий'
          : `Готово: ${r.was_active ? `було до ${fmt(r.previous_until)}, ` : 'раніше преміуму не було, '}тепер до ${fmt(r.new_until)}`,
      )
      setVersion((v) => v + 1)
    } catch (err) {
      setPlanMessage(
        err instanceof ApiError && err.detail === 'user_not_found'
          ? 'Користувача з такою поштою не знайдено (він має хоч раз увійти на сайт)'
          : err instanceof ApiError && err.detail === 'bad_period'
            ? 'Вкажіть коректний період'
            : 'Не вдалося видати преміум',
      )
    }
  }

  async function resetToFree() {
    if (!email.trim()) return setPlanMessage('Спочатку вкажіть пошту користувача')
    const ok = await askConfirm({
      title: `Повернути ${email.trim()} на безкоштовний тариф?`,
      text: 'Решта оплаченого преміуму зникне. Це буде записано в історії.',
      confirmLabel: 'Повернути',
      cancelLabel: 'Скасувати',
      danger: true,
    })
    if (!ok) return
    try {
      await apiFetch('/api/admin/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), plan: 'free', days: null }),
      })
      setPlanMessage('Користувача повернуто на безкоштовний тариф')
      setVersion((v) => v + 1)
    } catch (err) {
      setPlanMessage(
        err instanceof ApiError && err.detail === 'user_not_found'
          ? 'Користувача з такою поштою не знайдено'
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
          <SectionRail items={RAIL} side />
          <div className="grid" id="adm-stats" style={{ marginBottom: 20 }}>
            {cards.map(([label, value]) => (
              <section key={label} className="card" style={{ padding: 16 }}>
                <div className="muted">{label}</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800 }}>{value}</div>
              </section>
            ))}
          </div>

          <div className="grid" id="adm-charts" style={{ marginBottom: 20 }}>
            <Bars days={stats.daily} field="signups" title="Реєстрації за 14 днів" />
            <Bars days={stats.daily} field="preorders" title="Передзамовлення за 14 днів" />
          </div>

          <section className="card" id="adm-notice">
            <h3>Оголошення на всьому сайті</h3>
            <p className="muted">
              Повідомлення зверху на кожній сторінці для всіх відвідувачів, також для тих, хто ще не ввійшов. Наприклад,
              «у нас технічні проблеми». Користувач може закрити його до кінця візиту.
            </p>
            <form onSubmit={saveNotice}>
              <label className="inline" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={noticeOn} onChange={(e) => setNoticeOn(e.target.checked)} /> Показувати на сайті
              </label>
              <div className="actions" style={{ marginBottom: 10 }}>
                <span className="muted">Заготовки:</span>
                <button type="button" onClick={() => {
                  setNoticeLevel('warning')
                  setNoticeUk('У нас технічні проблеми. Ми вже працюємо над виправленням, дякуємо за терпіння.')
                  setNoticeEn('We are having technical problems. We are already working on a fix, thank you for your patience.')
                }}>Технічні проблеми</button>
                <button type="button" onClick={() => {
                  setNoticeLevel('info')
                  setNoticeUk('Сьогодні можливі короткі перерви в роботі сайту через планові технічні роботи.')
                  setNoticeEn('Short interruptions are possible today because of planned maintenance.')
                }}>Планові роботи</button>
              </div>
              <label>
                Вигляд
                <select value={noticeLevel} onChange={(e) => setNoticeLevel(e.target.value as 'info' | 'warning')} style={{ maxWidth: 320 }}>
                  <option value="warning">Попередження (жовте)</option>
                  <option value="info">Інформація (бірюзове)</option>
                </select>
              </label>
              <label>
                Текст українською
                <textarea maxLength={500} value={noticeUk} onChange={(e) => setNoticeUk(e.target.value)} />
              </label>
              <label>
                Текст англійською (необов’язково: якщо порожньо, англомовні побачать український)
                <textarea maxLength={500} value={noticeEn} onChange={(e) => setNoticeEn(e.target.value)} />
              </label>
              {(noticeUk.trim() || noticeEn.trim()) && (
                <div style={{ marginBottom: 14 }}>
                  <small className="muted">Так це виглядатиме:</small>
                  <div style={{ marginTop: 6 }}>
                    <NoticeBar level={noticeLevel} text={noticeUk.trim() || noticeEn.trim()} />
                  </div>
                </div>
              )}
              <button type="submit">Зберегти</button>
              {noticeMessage && <span className="muted"> {noticeMessage}</span>}
            </form>
          </section>

          <section className="card" id="adm-sentry">
            <h3>Моніторинг помилок (Sentry)</h3>
            <p className="muted">
              Надсилає по одній тестовій помилці з сайту й із сервера, щоб перевірити, що Sentry їх
              отримує.
            </p>
            <button onClick={testMonitoring}>Надіслати тестову помилку</button>
            {testMessage && <p className="status" style={{ marginTop: 12 }}>{testMessage}</p>}
          </section>

          <section className="card" id="adm-plans">
            <h3>Преміум користувачів</h3>
            <p className="muted">
              Період завжди <strong>додається</strong> до того, що в людини вже є: якщо преміум діє до 1 грудня, а ви додали
              3 місяці, він діятиме до 1 березня. Якщо преміум уже закінчився, відлік іде від сьогодні.
            </p>
            <form onSubmit={grantPremium}>
              <div className="row align-end">
                <label>
                  Email користувача
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                  Скільки додати
                  <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                    <option value="1">1 місяць</option>
                    <option value="3">3 місяці</option>
                    <option value="6">6 місяців</option>
                    <option value="12">1 рік (12 місяців)</option>
                    <option value="days">Власна кількість днів</option>
                    <option value="unlimited">Безстроково</option>
                  </select>
                </label>
                {period === 'days' && (
                  <label>
                    Днів
                    <input type="number" min={1} max={3650} required value={days} onChange={(e) => setDays(e.target.value)} />
                  </label>
                )}
              </div>
              <div className="actions">
                <button type="submit">Додати преміум</button>
                <button type="button" className="danger" onClick={() => void resetToFree()}>Повернути на безкоштовний</button>
              </div>
              {planMessage && <p className="status" style={{ marginTop: 12 }}>{planMessage}</p>}
            </form>

            {preorders.length > 0 && (
              <p style={{ marginTop: 16 }}>
                <strong>Передзамовлення за періодами:</strong>{' '}
                {preorders.map((p) => `${p.months ? `${p.months} міс` : 'без періоду'}: ${p.count}`).join(' · ')}
              </p>
            )}
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
            <h4 style={{ margin: '22px 0 8px' }}>Історія видачі преміуму</h4>
            {grants.length === 0 ? (
              <p className="muted">Поки що нічого не видавали.</p>
            ) : (
              <div className="week-scroll" style={{ boxShadow: 'none' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Коли</th>
                      <th>Email</th>
                      <th>Як</th>
                      <th>Що додано</th>
                      <th>Було до</th>
                      <th>Стало до</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((g, i) => (
                      <tr key={`${g.granted_at}-${i}`}>
                        <td>{fmt(g.granted_at)}</td>
                        <td>{g.email ?? '—'}</td>
                        <td>{g.source === 'promo' ? `промокод ${g.note}` : g.source === 'card' ? `оплата карткою ${g.note}` : g.source === 'admin' ? 'вручну' : 'повернуто на безкоштовний'}</td>
                        <td>{grantLabel(g)}</td>
                        <td>{g.source === 'reset' ? (g.was_active ? (g.previous_until ? fmt(g.previous_until) : 'безстроково') : '—') : g.was_active ? (g.previous_until ? fmt(g.previous_until) : 'безстроково') : 'не було'}</td>
                        <td>{g.source === 'reset' ? 'безкоштовний' : g.new_until ? fmt(g.new_until) : 'безстроково'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card" id="adm-promo">
            <h3>Промокоди</h3>
            <p className="muted">
              Код дає преміум на вказану кількість днів і додається до того, що в людини вже є. Людина вводить його на
              сторінці «Тарифи». Залиште поле коду порожнім, і він згенерується сам.
            </p>
            <form onSubmit={createPromo}>
              <div className="row align-end">
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
                  Кількість активацій
                  <input type="number" min={1} max={100000} value={promoUses} onChange={(e) => setPromoUses(e.target.value)} />
                </label>
              </div>
              <p className="muted" style={{ margin: '0 0 12px' }}>
                <small>Якщо залишити кількість активацій порожньою, код можна використовувати без обмежень.</small>
              </p>
              <label>
                Повідомлення після активації (необов’язково)
                <textarea value={promoMsgUk} maxLength={1000} rows={3}
                  placeholder="Наприклад: Дякуємо, що відповіли на наше опитування! Даруємо вам 7 днів преміуму."
                  onChange={(e) => setPromoMsgUk(e.target.value)} />
              </label>
              <label>
                Те саме англійською (для тих, у кого сайт англійською; якщо порожньо, покажемо українське)
                <textarea value={promoMsgEn} maxLength={1000} rows={2} onChange={(e) => setPromoMsgEn(e.target.value)} />
              </label>
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
                      <th className="num">Днів</th>
                      <th className="num">Активовано</th>
                      <th>Створено</th>
                      <th>Повідомлення</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {promos.map((p) => (
                      <Fragment key={p.code}>
                        <tr>
                          <td><strong>{p.code}</strong></td>
                          <td className="num">{p.days}</td>
                          <td className="num">
                            {p.used_count} / {p.max_uses ?? '∞'}
                          </td>
                          <td>{fmt(p.created_at)}</td>
                          <td className="promo-msg-cell">
                            {p.message_uk || p.message_en ? (
                              <span title={p.message_uk ?? p.message_en ?? ''}>{p.message_uk || p.message_en}</span>
                            ) : (
                              <span className="muted">стандартне</span>
                            )}{' '}
                            <button type="button" className="secondary" onClick={() => startEditing(p)}>Змінити</button>
                          </td>
                          <td>
                            <button type="button" className="danger" onClick={() => void deletePromo(p.code)}>Видалити</button>
                          </td>
                        </tr>
                        {editingPromo === p.code && (
                          <tr>
                            <td colSpan={6}>
                              <label>
                                Повідомлення для {p.code} українською
                                <textarea value={editUk} maxLength={1000} rows={3} onChange={(e) => setEditUk(e.target.value)} />
                              </label>
                              <label>
                                Англійською
                                <textarea value={editEn} maxLength={1000} rows={2} onChange={(e) => setEditEn(e.target.value)} />
                              </label>
                              <p className="muted" style={{ margin: '0 0 8px' }}>
                                <small>Порожні поля повертають стандартне «Преміум активовано».</small>
                              </p>
                              {(editUk.trim() || editEn.trim()) && (
                                <div className="promo-note" style={{ marginBottom: 10 }}>
                                  <small className="muted">Так це побачить людина:</small>
                                  <p>{editUk.trim() || editEn.trim()}</p>
                                </div>
                              )}
                              <div className="actions">
                                <button type="button" onClick={() => void savePromoMessage(p.code)}>Зберегти</button>
                                <button type="button" className="secondary" onClick={() => setEditingPromo(null)}>Скасувати</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card" id="adm-pay">
            <h3>Оплата карткою</h3>
            <p className="muted">
              Людина обирає період на сторінці «Тарифи», отримує код замовлення (ML-XXXXXX), переказує гроші на вашу
              картку monobank і пише код у коментарі. monobank повідомляє сервер, і преміум додається сам.
            </p>
            {pay && (
              <ul className="muted" style={{ listStyle: 'none', paddingLeft: 0 }}>
                <li>{pay.card_set ? '✓' : '✗'} Номер картки задано (змінна PAYMENT_CARD у Render)</li>
                <li>{pay.secret_set ? '✓' : '✗'} Секрет створено тут</li>
                <li>{pay.secret_in_environment ? '✓' : '✗'} Секрет додано в Render (PAYMENTS_SECRET)</li>
                <li>{pay.secret_matches ? '✓' : '✗'} Секрет у Render збігається з тим, що тут</li>
                <li>{pay.bank_check ? '✓' : '–'} Додаткова перевірка виписки (MONOBANK_TOKEN, необов’язково)</li>
              </ul>
            )}
            <div className="actions">
              <button type="button" onClick={() => void makeSecret()}>
                {pay?.secret_set ? 'Створити новий секрет' : 'Створити секрет'}
              </button>
            </div>
            {newSecret && (
              <div className="card" style={{ marginTop: 12 }}>
                <p><strong>Секрет показано один раз, збережіть його зараз:</strong></p>
                <p><code style={{ wordBreak: 'break-all' }}>{newSecret}</code></p>
                <p className="muted">1. У Render додайте змінну <code>PAYMENTS_SECRET</code> з цим значенням.</p>
                <p className="muted">2. Адреса для monobank (зареєструйте її за інструкцією в README):</p>
                <p><code style={{ wordBreak: 'break-all' }}>{`${API_URL}/api/payments/monobank/${newSecret}`}</code></p>
              </div>
            )}
            {pay && (
              <p style={{ marginTop: 12 }}>
                Очікують: <strong>{pay.pending}</strong> · Оплачено: <strong>{pay.paid}</strong> · Усього:{' '}
                <strong>{pay.paid_uah} грн</strong>
              </p>
            )}
            {payMessage && <p className="status">{payMessage}</p>}
            {pay && pay.orders.length > 0 && (
              <div className="week-scroll" style={{ boxShadow: 'none', marginTop: 16 }}>
                <table className="data">
                  <thead>
                    <tr><th>Код</th><th>Пошта</th><th>Період</th><th>Сума</th><th>Статус</th><th>Створено</th><th /></tr>
                  </thead>
                  <tbody>
                    {pay.orders.map((o) => (
                      <tr key={o.code}>
                        <td><code>{o.code}</code></td>
                        <td>{o.email ?? '—'}</td>
                        <td>{o.months} міс</td>
                        <td>{o.amount_uah} грн</td>
                        <td>
                          {o.status === 'paid'
                            ? `оплачено (${o.paid_by === 'auto' ? 'автоматично' : 'вручну'})`
                            : o.status === 'pending' ? 'очікує' : 'скасовано'}
                        </td>
                        <td>{fmt(o.created_at)}</td>
                        <td>
                          {o.status === 'pending' && (
                            <button type="button" onClick={() => void confirmOrder(o)}>Підтвердити</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card" id="adm-feedback">
            <h3>
              Відгуки{' '}
              {feedback && feedback.new_count > 0 && <span className="badge paid">нових: {feedback.new_count}</span>}
            </h3>
            <p className="muted">
              Повідомлення з форми на сторінці «Допомога». Відповісти можна на пошту автора, натиснувши на неї. Коли
              опрацювали, натисніть «Опрацьовано».
            </p>
            {feedback && feedback.items.length === 0 && <p className="muted">Поки що відгуків немає.</p>}
            {feedback && feedback.items.length > 0 && (
              <ul className="cards">
                {feedback.items.map((f) => (
                  <li key={f.id} style={{ opacity: f.status === 'done' ? 0.6 : 1 }}>
                    <strong>{FEEDBACK_KINDS[f.category]}</strong>
                    {' · '}
                    {f.email ? <a href={`mailto:${f.email}`}>{f.email}</a> : 'без пошти'}
                    {' · '}
                    <span className="muted">{fmt(f.created_at)}</span>
                    {f.page && <span className="muted"> · {f.page}</span>}
                    <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0' }}>{f.message}</p>
                    <button type="button" onClick={() => void setFeedbackStatus(f, f.status === 'done' ? 'new' : 'done')}>
                      {f.status === 'done' ? 'Повернути в нові' : 'Опрацьовано'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card red" id="adm-users">
            <h3>Користувачі (останні 200)</h3>
            <div className="week-scroll" style={{ boxShadow: 'none' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Вхід</th>
                    <th>Реєстрація</th>
                    <th>Остання активність</th>
                    <th className="num">Профіль</th>
                    <th className="num">Страв</th>
                    <th className="num">У календарі</th>
                    <th className="num">Передзамовив</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.users.map((u) => (
                    <tr key={`${u.email}-${u.created_at}`}>
                      <td>{u.email ?? '—'}</td>
                      <td>{u.provider ?? '—'}</td>
                      <td>{fmt(u.created_at)}</td>
                      <td>{fmt(u.last_sign_in_at)}</td>
                      <td className="num">{u.has_profile && <span className="ok">✓</span>}</td>
                      <td className="num">{u.dishes}</td>
                      <td className="num">{u.planned}</td>
                      <td className="num">{u.preordered && <span className="ok">✓</span>}</td>
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
