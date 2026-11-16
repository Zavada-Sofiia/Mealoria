import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { ApiError, apiFetch } from '../api/client'
import { usePageMeta } from '../seo'
import { formatDate, limitLines, usePlan } from '../plan/context'
import { getLang, t } from '../i18n'
import PayByCode, { type PayInfo } from '../components/PayByCode'

// Shown to visitors; change here when the real prices are decided (hryvnias).
const MONTHLY = 49
const PERIODS = [
  { months: 1, price: 49 },
  { months: 3, price: 129 },
  { months: 6, price: 239 },
  { months: 12, price: 449 },
]

const FREE_FEATURES = [
  'Профіль, норма калорій і вподобання (дієта, алергени, кухні)',
  'Календар на тиждень: перетягування страв, повтор минулого тижня, друк у PDF та експорт у календар',
  'Власні страви з порціями, типом прийому їжі, фото й улюбленими',
  'Каталог рецептів із фільтром за вашими вподобаннями',
  'Список продуктів із календаря й вручну, з урахуванням того, що вже є вдома',
  'Калорії, БЖВ і клітковина за день, графіки, журнал ваги та калькулятор страви',
  'ШІ: калорії по фото, підбір рецептів і рецепти з холодильника (у межах денного ліміту)',
  'Темна тема, українська й англійська, установка на телефон',
]
const PREMIUM_EXTRAS = [
  'ШІ сам рахує калорії, БЖВ і клітковину ваших страв',
  'ШІ пише рецепт та інгредієнти за назвою страви',
]

export default function Pricing({ session }: { session: Session | null }) {
  usePageMeta(
    t('Тарифи Mealoria: безкоштовний і преміум'),
    t('Що входить у безкоштовний тариф Mealoria і що додає преміум: ліміти страв і ШІ-запитів, планування на рік, ШІ-фото та автоматичні калорії.'),
  )
  const { me, table, refresh } = usePlan()
  const [promo, setPromo] = useState('')
  const [promoMessage, setPromoMessage] = useState('')
  // the admin's own text for the redeemed code (for example a thank-you for a survey)
  const [promoNote, setPromoNote] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  const [preordered, setPreordered] = useState(false)
  const [preorderedMonths, setPreorderedMonths] = useState<number | null>(null)
  const [months, setMonths] = useState(1)
  const [status, setStatus] = useState('')
  const [pay, setPay] = useState<PayInfo | null>(null)

  useEffect(() => {
    if (!session) return
    apiFetch<PayInfo>('/api/payments/info').then(setPay).catch(() => {})
    apiFetch<{ preordered: boolean; months: number | null }>('/api/preorder')
      .then((r) => {
        setPreordered(r.preordered)
        setPreorderedMonths(r.months)
        if (r.months) setMonths(r.months)
      })
      .catch(() => setStatus(t('Не вдалося перевірити передзамовлення')))
  }, [session])

  async function redeem(e: FormEvent) {
    e.preventDefault()
    if (!promo.trim() || promoBusy) return
    setPromoBusy(true)
    setPromoMessage('')
    setPromoNote('')
    try {
      const r = await apiFetch<{
        days: number
        premium_until: string | null
        unlimited: boolean
        message_uk?: string | null
        message_en?: string | null
      }>('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promo }),
      })
      setPromo('')
      setPromoNote((getLang() === 'en' ? r.message_en || r.message_uk : r.message_uk || r.message_en) ?? '')
      setPromoMessage(
        r.unlimited || !r.premium_until
          ? t('Преміум активовано на {days} дн. Він у вас безстроковий, нічого додавати не треба.', { days: r.days })
          : t('Преміум активовано на {days} дн. Діє до {date}.', { days: r.days, date: formatDate(r.premium_until).replace(/\.$/, '') }),
      )
      refresh()
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : ''
      setPromoMessage(
        detail === 'promo_not_found'
          ? t('Такого промокоду немає. Перевірте, чи правильно його введено.')
          : detail === 'promo_already_used'
            ? t('Ви вже використовували цей промокод.')
            : detail === 'promo_used_up'
              ? t('Цей промокод уже використано максимальну кількість разів.')
              : detail === 'promo_too_many'
                ? t('Забагато невдалих спроб. Спробуйте за годину.')
                : t('Не вдалося застосувати промокод. Спробуйте ще раз.'),
      )
    } finally {
      setPromoBusy(false)
    }
  }

  const base = PERIODS.find((p) => p.months === months) ?? PERIODS[0]
  const chosen = { ...base, price: pay?.prices[String(months)] ?? base.price }
  const saving = Math.round(100 * (1 - chosen.price / (MONTHLY * chosen.months)))

  async function preorder() {
    try {
      await apiFetch('/api/preorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months }),
      })
      setPreordered(true)
      setPreorderedMonths(months)
      setStatus('')
    } catch {
      setStatus(t('Не вдалося зберегти. Спробуйте ще раз'))
    }
  }

  return (
    <div>
      <h1>{t('Тарифи')}</h1>
      <div className="plans">
        <section className="card">
          <span className="badge">{t('Безкоштовно')}</span>
          <div className="price">{t('0 грн')}</div>
          <ul>
            {[...FREE_FEATURES, ...(table ? limitLines(table.free, false) : [])].map((f) => (
              <li key={f}>{t(f)}</li>
            ))}
          </ul>
          {me?.plan === 'free' && <p className="status">{t('Ваш поточний тариф')}</p>}
          {!session && (
            <Link to="/auth">
              <button>{t('Почати безкоштовно')}</button>
            </Link>
          )}
        </section>

        <section className="card red">
          <span className="badge paid">{t('Преміум')}</span>
          <div className="seg" role="radiogroup" aria-label={t('Період')} style={{ margin: '4px 0 12px' }}>
            {PERIODS.map((p) => (
              <button key={p.months} type="button" role="radio" aria-checked={months === p.months}
                className={months === p.months ? 'on' : ''} onClick={() => setMonths(p.months)}>
                {t('{n} міс', { n: p.months })}
              </button>
            ))}
          </div>
          <div className="price">{t('{price} грн / {n} міс', { price: chosen.price, n: chosen.months })}</div>
          <p className="muted" style={{ marginTop: 0 }}>
            {t('{n} грн на місяць', { n: Math.round(chosen.price / chosen.months) })}
            {saving > 0 && <span className="badge paid" style={{ marginLeft: 10 }}>{t('Економія {pct}%', { pct: saving })}</span>}
          </p>
          <p className="muted">
            {/* a visitor cannot ask whether card payment is on, so the text does not promise either way */}
            {!session
              ? t('Оформити преміум можна після входу: оберіть період і оплатіть переказом на картку.')
              : pay?.enabled
                ? t('Обирайте період і оплачуйте переказом на картку: преміум додасться до того, що в вас уже є.')
                : t('Більші ліміти вже працюють. Оплату підключимо найближчим часом: передзамовте, і ми повідомимо.')}
          </p>
          <p>
            <strong>{t('Усе з безкоштовного тарифу, а також:')}</strong>
          </p>
          <ul>
            {[...(table ? limitLines(table.premium, true) : []), ...PREMIUM_EXTRAS].map((f) => (
              <li key={f}>{t(f)}</li>
            ))}
          </ul>
          {me?.plan === 'premium' && (
            <p className="status">
              {t('Ваш поточний тариф')}
              {me.premium_until ? `. ${t('Діє до {date}', { date: formatDate(me.premium_until) })}` : ''}
            </p>
          )}
          {!session ? (
            <Link to="/auth">{t('Увійдіть, щоб оформити преміум')}</Link>
          ) : pay?.enabled ? (
            // Premium users can pay too: the period is added to the end date they already have
            me?.plan === 'premium' && !me.premium_until ? null : <PayByCode info={pay} months={months} onPaid={refresh} />
          ) : me?.plan === 'premium' ? null : preordered && preorderedMonths === months ? (
            <p className="status">{t('Дякуємо! Ви в списку передзамовлень на {n} міс. Гроші зараз не списуються.', { n: months })}</p>
          ) : (
            <>
              <button onClick={preorder}>
                {preordered
                  ? t('Змінити період на {n} міс', { n: months })
                  : t('Передзамовити преміум на {n} міс', { n: months })}
              </button>
              <p>
                <small>{t('Гроші зараз не списуються.')}</small>
              </p>
            </>
          )}
        </section>
      </div>
      {session && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>{t('Маєте промокод?')}</h2>
          <p className="muted">{t('Введіть код, і преміум активується на вказану кількість днів.')}</p>
          <form onSubmit={redeem} className="actions">
            <input value={promo} maxLength={40} placeholder={t('Промокод')} autoCapitalize="characters" autoComplete="off"
              style={{ maxWidth: 260, textTransform: 'uppercase' }} onChange={(e) => setPromo(e.target.value)} />
            <button type="submit" disabled={promoBusy || !promo.trim()}>
              {promoBusy ? t('Перевіряємо…') : t('Активувати')}
            </button>
          </form>
          {promoNote && (
            <div className="promo-note" role="status">
              <p>{promoNote}</p>
            </div>
          )}
          {promoMessage && <p className="status" style={{ marginTop: 12 }}>{promoMessage}</p>}
        </section>
      )}
      {status && <p className="status">{status}</p>}
      <p>
        <Link to="/support">{t('Підтримати проєкт донатом')}</Link>
      </p>
    </div>
  )
}
