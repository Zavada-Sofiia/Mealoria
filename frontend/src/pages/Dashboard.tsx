import { useEffect, useState } from 'react'
import { useCountUp } from '../useCountUp'
import StatusLine from '../components/StatusLine'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { supabase } from '../api/supabase'
import CalorieRing from '../components/CalorieRing'
import GettingStarted from '../components/GettingStarted'
import { iso, mondayOf } from '../dates'
import { mealName } from '../meals'
import { locale, t } from '../i18n'
import { energyUnit, showEnergy } from '../units'
import { macrosLine, macrosVsTargets } from '../macros'
import { targetsFromProfile } from '../nutrition'

type Day = {
  target: number | null
  total: { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number }
  meals: { slot: number; kcal: number; dishes: string[] }[]
}
type Profile = {
  profile: { meals_per_day: number; weight_kg: number; goal: string; activity: string; target_calories: number | null } | null
  recommended_calories: number | null
}
type Shopping = { items: { checked: boolean }[] }

function greeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return t('Доброго ранку')
  if (hour >= 12 && hour < 18) return t('Доброго дня')
  return t('Доброго вечора')
}

export default function Dashboard() {
  const [day, setDay] = useState<Day | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [toBuy, setToBuy] = useState<number | null>(null)
  const [weekPlanned, setWeekPlanned] = useState<boolean | null>(null)
  const [dismissKey, setDismissKey] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [status, setStatus] = useState(t('Завантаження…'))
  const [dateLabel] = useState(() =>
    new Date()
      .toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
      .replace(/^./, (c) => c.toUpperCase()),
  )

  // the checklist can be hidden; this is remembered in this browser, per account
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const key = `mealoria.started.v1.${data.session?.user.id ?? ''}`
      setDismissKey(key)
      try {
        setDismissed(localStorage.getItem(key) === '1')
      } catch {
        setDismissed(false)
      }
    })
  }, [])

  function dismissChecklist() {
    setDismissed(true)
    try {
      if (dismissKey) localStorage.setItem(dismissKey, '1')
    } catch {
      // not remembered: it will show again next time
    }
  }

  useEffect(() => {
    const today = iso(new Date())
    Promise.all([
      apiFetch<Day>(`/api/calories/day?date=${today}`),
      apiFetch<Profile>('/api/profile'),
      apiFetch<Shopping>(`/api/shopping?start=${iso(mondayOf(new Date()))}`),
      // products added by hand also count; a failure here must not hide the rest of the page
      apiFetch<{ checked: boolean }[]>('/api/shopping/manual').catch(() => []),
      apiFetch<unknown[]>(`/api/calendar?start=${iso(mondayOf(new Date()))}`).catch(() => null),
    ])
      .then(([d, p, s, own, week]) => {
        setWeekPlanned(week ? week.length > 0 : null)
        setDay(d)
        setProfile(p)
        setToBuy(s.items.filter((i) => !i.checked).length + own.filter((i) => !i.checked).length)
        setStatus('')
      })
      .catch(() => setStatus(t('Не вдалося завантажити дані. Спробуйте оновити сторінку')))
  }, [])

  const meals = profile?.profile?.meals_per_day ?? 3
  const targets = targetsFromProfile(profile)
  const total = Math.round(day?.total.kcal ?? 0)
  const target = day?.target

  const shownTotal = useCountUp(total)
  const shownBuy = useCountUp(toBuy ?? 0)

  return (
    <div>
      <p className="greeting">{greeting()}</p>
      <h1>{t('Сьогодні')}</h1>
      <p className="muted">{dateLabel}</p>
      <StatusLine text={status} />

      {profile && weekPlanned === false && dismissed === false && (
        <GettingStarted hasProfile={!!profile.profile} onDismiss={dismissChecklist} />
      )}
      {profile && !profile.profile && dismissed === true && (
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
                        {meal.dishes.join(', ')} <span className="muted">· {showEnergy(meal.kcal)} {energyUnit()}</span>
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
            {target ? (
              <CalorieRing
                value={showEnergy(shownTotal)}
                goal={showEnergy(target)}
                label={String(showEnergy(Math.round(shownTotal)))}
                unit={energyUnit()}
              />
            ) : (
              <p>
                <strong style={{ fontSize: '1.6rem' }}>{showEnergy(Math.round(shownTotal))}</strong> {energyUnit()}
              </p>
            )}
            <p className="muted">
              {targets
                ? macrosVsTargets(day.total, targets)
                : macrosLine(day.total.protein_g, day.total.fat_g, day.total.carbs_g, day.total.fiber_g, true)}
            </p>
            <Link to="/calories">{t('Деталі →')}</Link>
          </section>

          <section className="card red">
            <h3>{t('Список продуктів')}</h3>
            <p>
              <strong style={{ fontSize: '1.6rem' }}>{Math.round(shownBuy)}</strong>{' '}
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
