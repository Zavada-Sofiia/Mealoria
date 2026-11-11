import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { apiFetch } from '../api/client'
import { usePageMeta } from '../seo'
import { formatDate, limitLines, usePlan } from '../plan/context'
import { t } from '../i18n'

// Shown to visitors; change here when the real price is decided.
const PREMIUM_PRICE = '49 грн / міс'

const FREE_FEATURES = [
  'Профіль, норма калорій і вподобання (дієта, алергени, кухні)',
  'Календар на тиждень: перетягування страв, повтор минулого тижня, друк у PDF та експорт у календар',
  'Власні страви з порціями, типом прийому їжі, фото й улюбленими',
  'Каталог рецептів із фільтром за вашими вподобаннями',
  'Список продуктів із календаря й вручну, з урахуванням того, що вже є вдома',
  'Калорії, БЖВ і клітковина за день, графіки, журнал ваги та калькулятор страви',
  'ШІ-помічник: підбір рецептів, рецепти з холодильника та калорії по фото (у межах денного ліміту)',
  'Темна тема, українська й англійська, установка на телефон',
]
const PREMIUM_EXTRAS = [
  'ШІ сам рахує калорії, БЖВ і клітковину ваших страв',
  'ШІ пише рецепт та інгредієнти за назвою страви',
  'Меню на сьогодні на головному екрані телефона (скоро)',
]

export default function Pricing({ session }: { session: Session | null }) {
  usePageMeta(
    t('Тарифи Mealoria: безкоштовний і преміум'),
    t('Що входить у безкоштовний тариф Mealoria і що додає преміум: ліміти страв і ШІ-запитів, планування на рік, ШІ-фото та автоматичні калорії.'),
  )
  const { me, table } = usePlan()
  const [preordered, setPreordered] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!session) return
    apiFetch<{ preordered: boolean }>('/api/preorder')
      .then((r) => setPreordered(r.preordered))
      .catch(() => setStatus(t('Не вдалося перевірити передзамовлення')))
  }, [session])

  async function preorder() {
    try {
      await apiFetch('/api/preorder', { method: 'POST' })
      setPreordered(true)
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
          <div className="price">{t(PREMIUM_PRICE)}</div>
          <p className="muted">
            {t('Більші ліміти вже працюють. Оплату підключимо найближчим часом: передзамовте, і ми повідомимо.')}
          </p>
          <p>
            <strong>{t('Усе з безкоштовного тарифу, а також:')}</strong>
          </p>
          <ul>
            {[...(table ? limitLines(table.premium, true) : []), ...PREMIUM_EXTRAS].map((f) => (
              <li key={f}>{t(f)}</li>
            ))}
          </ul>
          {me?.plan === 'premium' ? (
            <p className="status">
              {t('Ваш поточний тариф')}
              {me.premium_until ? `. ${t('Діє до {date}', { date: formatDate(me.premium_until) })}` : ''}
            </p>
          ) : !session ? (
            <Link to="/auth">{t('Увійдіть, щоб передзамовити')}</Link>
          ) : preordered ? (
            <p className="status">{t('Дякуємо! Ви в списку передзамовлень. Гроші зараз не списуються.')}</p>
          ) : (
            <>
              <button onClick={preorder}>{t('Передзамовити преміум')}</button>
              <p>
                <small>{t('Гроші зараз не списуються.')}</small>
              </p>
            </>
          )}
        </section>
      </div>
      {status && <p className="status">{status}</p>}
      <p>
        <Link to="/support">{t('Підтримати проєкт донатом')}</Link>
      </p>
    </div>
  )
}
