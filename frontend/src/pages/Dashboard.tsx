import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { iso, mondayOf } from '../dates'
import { mealName } from '../meals'

type Day = {
  target: number | null
  total: { kcal: number; protein_g: number; fat_g: number; carbs_g: number }
  meals: { slot: number; kcal: number; dishes: string[] }[]
}
type Profile = { profile: { meals_per_day: number } | null }
type Shopping = { items: { checked: boolean }[] }

export default function Dashboard() {
  const [day, setDay] = useState<Day | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [toBuy, setToBuy] = useState<number | null>(null)
  const [status, setStatus] = useState('Завантаження…')
  const [dateLabel] = useState(() =>
    new Date()
      .toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })
      .replace(/^./, (c) => c.toUpperCase()),
  )

  useEffect(() => {
    const today = iso(new Date())
    Promise.all([
      apiFetch<Day>(`/api/calories/day?date=${today}`),
      apiFetch<Profile>('/api/profile'),
      apiFetch<Shopping>(`/api/shopping?start=${iso(mondayOf(new Date()))}`),
    ])
      .then(([d, p, s]) => {
        setDay(d)
        setProfile(p)
        setToBuy(s.items.filter((i) => !i.checked).length)
        setStatus('')
      })
      .catch(() => setStatus('Не вдалося завантажити дані. Спробуйте оновити сторінку'))
  }, [])

  const meals = profile?.profile?.meals_per_day ?? 3
  const total = Math.round(day?.total.kcal ?? 0)
  const target = day?.target

  return (
    <div>
      <h1>Сьогодні</h1>
      <p className="muted">{dateLabel}</p>
      {status && <p className="status">{status}</p>}

      {profile && !profile.profile && (
        <section className="card red">
          <h3>Почніть із профілю</h3>
          <p>
            Вкажіть вік, зріст, вагу та мету, і ми порахуємо ваш калораж і підлаштуємо кількість
            прийомів їжі.
          </p>
          <Link to="/profile">
            <button>Заповнити профіль</button>
          </Link>
        </section>
      )}

      {day && (
        <div className="grid">
          <section className="card">
            <h3>Меню на сьогодні</h3>
            <ul className="plain">
              {Array.from({ length: meals }, (_, slot) => {
                const meal = day.meals.find((m) => m.slot === slot)
                return (
                  <li key={slot}>
                    <strong>{mealName(meals, slot)}</strong>
                    <br />
                    {meal ? (
                      <>
                        {meal.dishes.join(', ')} <span className="muted">· {Math.round(meal.kcal)} ккал</span>
                      </>
                    ) : (
                      <span className="muted">Не заплановано</span>
                    )}
                  </li>
                )
              })}
            </ul>
            <Link to="/calendar">Відкрити календар →</Link>
          </section>

          <section className="card">
            <h3>Калорії</h3>
            <p>
              <strong style={{ fontSize: '1.6rem' }}>{total}</strong>
              {target ? ` / ${target} ккал` : ' ккал'}
            </p>
            {target ? <progress value={Math.min(total, target)} max={target} /> : null}
            <p className="muted">
              Б {day.total.protein_g} · Ж {day.total.fat_g} · В {day.total.carbs_g} г
            </p>
            <Link to="/calories">Деталі →</Link>
          </section>

          <section className="card red">
            <h3>Список продуктів</h3>
            <p>
              <strong style={{ fontSize: '1.6rem' }}>{toBuy ?? 0}</strong>{' '}
              <span className="muted">лишилось купити цього тижня</span>
            </p>
            <Link to="/shopping">Відкрити список →</Link>
          </section>
        </div>
      )}

      <h2>Швидкі дії</h2>
      <div className="actions">
        <Link to="/dishes">
          <button>Додати страву</button>
        </Link>
        <Link to="/recipes">
          <button>Знайти рецепт</button>
        </Link>
        <Link to="/calendar">
          <button>Спланувати тиждень</button>
        </Link>
      </div>
    </div>
  )
}
