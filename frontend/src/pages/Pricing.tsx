import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { apiFetch } from '../api/client'
import { formatDate, limitLines, usePlan } from '../plan/context'

// Shown to visitors; change here when the real price is decided.
const PREMIUM_PRICE = '49 грн / міс'

const FREE_FEATURES = [
  'Реєстрація, профіль і вподобання',
  'Календар із переміщенням страв',
  'Каталог рецептів і калькулятор калорій',
  'Список продуктів з календаря',
]
const PREMIUM_EXTRAS = ['Фото до власної страви від ШІ', 'Меню на сьогодні на головному екрані телефона']

export default function Pricing({ session }: { session: Session | null }) {
  const { me, table } = usePlan()
  const [preordered, setPreordered] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!session) return
    apiFetch<{ preordered: boolean }>('/api/preorder')
      .then((r) => setPreordered(r.preordered))
      .catch(() => setStatus('Не вдалося перевірити передзамовлення'))
  }, [session])

  async function preorder() {
    try {
      await apiFetch('/api/preorder', { method: 'POST' })
      setPreordered(true)
      setStatus('')
    } catch {
      setStatus('Не вдалося зберегти. Спробуйте ще раз')
    }
  }

  return (
    <div>
      <h1>Тарифи</h1>
      <div className="plans">
        <section className="card">
          <span className="badge">Безкоштовно</span>
          <div className="price">0 грн</div>
          <ul>
            {[...FREE_FEATURES, ...(table ? limitLines(table.free, false) : [])].map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {me?.plan === 'free' && <p className="status">Ваш поточний тариф</p>}
          {!session && (
            <Link to="/auth">
              <button>Почати безкоштовно</button>
            </Link>
          )}
        </section>

        <section className="card red">
          <span className="badge paid">Преміум</span>
          <div className="price">{PREMIUM_PRICE}</div>
          <p className="muted">
            Більші ліміти вже працюють. Оплату підключимо найближчим часом: передзамовте, і ми
            повідомимо.
          </p>
          <ul>
            {[...(table ? limitLines(table.premium, true) : []), ...PREMIUM_EXTRAS].map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {me?.plan === 'premium' ? (
            <p className="status">
              Ваш поточний тариф{me.premium_until ? `. Діє до ${formatDate(me.premium_until)}` : ''}
            </p>
          ) : !session ? (
            <Link to="/auth">Увійдіть, щоб передзамовити</Link>
          ) : preordered ? (
            <p className="status">Дякуємо! Ви в списку передзамовлень. Гроші зараз не списуються.</p>
          ) : (
            <>
              <button onClick={preorder}>Передзамовити преміум</button>
              <p>
                <small>Гроші зараз не списуються.</small>
              </p>
            </>
          )}
        </section>
      </div>
      {status && <p className="status">{status}</p>}
      <p>
        <Link to="/support">Підтримати проєкт донатом</Link>
      </p>
    </div>
  )
}
