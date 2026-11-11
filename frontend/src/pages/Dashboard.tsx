import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { iso, mondayOf } from '../dates'
import { mealName } from '../meals'
import { locale, t } from '../i18n'
import { macrosLine } from '../macros'

type Day = {
  target: number | null
  total: { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number }
  meals: { slot: number; kcal: number; dishes: string[] }[]
}
type Profile = { profile: { meals_per_day: number } | null }
type Shopping = { items: { checked: boolean }[] }

export default function Dashboard() {
  const [day, setDay] = useState<Day | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [toBuy, setToBuy] = useState<number | null>(null)
  const [status, setStatus] = useState(t('Завантаження…'))
  const [dateLabel] = useState(() =>
    new Date()
      .toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
      .replace(/^./, (c) => c.toUpperCase()),
  )

  useEffect(() => {
    const today = iso(new Date())
    Promise.all([
      apiFetch<Day>(`/api/calories/day?date=${today}`),
      apiFetch<Profile>('/api/profile'),
      apiFetch<Shopping>(`/api/shopping?start=${iso(mondayOf(new Date()))}`),
      // products added by hand also count; a failure here must not hide the rest of the page
      apiFetch<{ checked: boolean }[]>('/api/shopping/manual').catch(() => []),
    ])
      .then(([d, p, s, own]) => {
        setDay(d)
        setProfile(p)
        setToBuy(s.items.filter((i) => !i.checked).length + own.filter((i) => !i.checked).length)
        setStatus('')
      })
      .catch(() => setStatus(t('Не вдалося завантажити дані. Спробуйте оновити сторінку')))
  }, [])

  const meals = profile?.profile?.meals_per_day ?? 3
  const total = Math.round(day?.total.kcal ?? 0)
  const target = day?.target

  return (
    <div>
      <h1>{t('Сьогодні')}</h1>
      <p className="muted">{dateLabel}</p>
      {status && <p className="status">{status}</p>}

      {profile && !profile.profile && (
        <section className="card red">
          <h3>{t('Почніть із профілю')}</h3>
          <p>
            {t('Вкажіть вік, зріст, вагу та мету, і ми порахуємо ваш калораж і підлаштуємо кількість прийомів їжі.')}
          </p>
          <Link to="/profile">
            <button>{t('Заповнити профіль')}</button>
          </Link>
        </section>
      )}

      {day && (
        <div className="grid">
          <section className="card">
            <h3>{t('Меню на сьогодні')}</h3>
            <ul className="plain">
              {Array.from({ length: meals }, (_, slot) => {
                const meal = day.meals.find((m) => m.slot === slot)
                return (
                  <li key={slot}>
                    <strong>{mealName(meals, slot)}</strong>
                    <br />
                    {meal ? (
                      <>
                        {meal.dishes.join(', ')} <span className="muted">· {Math.round(meal.kcal)} {t('ккал')}</span>
                      </>
                    ) : (
                      <span className="muted">{t('Не заплановано')}</span>
                    )}
                  </li>
                )
              })}
            </ul>
            <Link to="/calendar">{t('Відкрити календар →')}</Link>
          </section>

          <section className="card">
            <h3>{t('Калорії')}</h3>
            <p>
              <strong style={{ fontSize: '1.6rem' }}>{total}</strong>
              {target ? ` / ${target} ${t('ккал')}` : ` ${t('ккал')}`}
            </p>
            {target ? (
              <progress className={total > target ? 'over' : undefined} value={Math.min(total, target)} max={target} />
            ) : null}
            <p className="muted">
              {macrosLine(day.total.protein_g, day.total.fat_g, day.total.carbs_g, day.total.fiber_g)}
            </p>
            <Link to="/calories">{t('Деталі →')}</Link>
          </section>

          <section className="card red">
            <h3>{t('Список продуктів')}</h3>
            <p>
              <strong style={{ fontSize: '1.6rem' }}>{toBuy ?? 0}</strong>{' '}
              <span className="muted">{t('лишилось купити цього тижня')}</span>
            </p>
            <Link to="/shopping">{t('Відкрити список →')}</Link>
          </section>
        </div>
      )}

      <h2>{t('Швидкі дії')}</h2>
      <div className="actions">
        <Link to="/dishes">
          <button>{t('Додати страву')}</button>
        </Link>
        <Link to="/recipes">
          <button>{t('Знайти рецепт')}</button>
        </Link>
        <Link to="/calendar">
          <button>{t('Спланувати тиждень')}</button>
        </Link>
        <Link to="/ai">
          <button>{t('ШІ-помічник')}</button>
        </Link>
      </div>
    </div>
  )
}
