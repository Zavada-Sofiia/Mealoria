import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { apiFetch } from '../api/client'

// Shown to visitors; change here when the real price is decided.
const PREMIUM_PRICE = '99 грн / міс'

const FREE = [
  'Реєстрація, профіль і вподобання',
  'Календар із переміщенням страв',
  'Власні страви з рецептом',
  'Каталог рецептів',
  'Список продуктів з календаря',
]
const PREMIUM = [
  'Розрахунок калорій по фото',
  'Фото до власної страви від ШІ',
  'Рецепти за вашими вподобаннями від ШІ',
  'Меню на сьогодні на головному екрані телефона',
]

export default function Pricing({ session }: { session: Session | null }) {
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

      <h2>Безкоштовно</h2>
      <ul>
        {FREE.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <h2>Преміум · {PREMIUM_PRICE}</h2>
      <p>Функції преміуму ще в розробці. Передзамовте, і ми повідомимо, коли вони з'являться.</p>
      <ul>
        {PREMIUM.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      {!session ? (
        <p>
          <Link to="/auth">Увійдіть, щоб передзамовити</Link>
        </p>
      ) : preordered ? (
        <p>Дякуємо! Ви в списку передзамовлень. Гроші зараз не списуються.</p>
      ) : (
        <p>
          <button onClick={preorder}>Передзамовити преміум</button> Гроші зараз не списуються.
        </p>
      )}
      {status && <p>{status}</p>}
      <p>
        <Link to="/support">Підтримати проєкт донатом</Link>
      </p>
    </div>
  )
}
