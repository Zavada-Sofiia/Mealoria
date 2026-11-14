import { addDays, fmtDate, fmtShortDate, iso } from '../dates'
import { mealName } from '../meals'
import { t } from '../i18n'
import { energyUnit, showEnergy } from '../units'
import { macrosLine } from '../macros'

type Dish = {
  name: string
  calories: number | null
  protein_g?: number | null
  fat_g?: number | null
  carbs_g?: number | null
  fiber_g?: number | null
}
type Entry = { id: string; date: string; slot: number; dish: Dish | null }

const SHORT_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const FULL_DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота', 'Неділя']
const sum = (list: Entry[], field: 'calories' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g') =>
  Math.round(list.reduce((s, e) => s + (e.dish?.[field] ?? 0), 0) * 10) / 10

/** The week as a printable page (shown only when printing or saving as PDF). */
export default function PrintableWeek({
  weekStart,
  entries,
  meals,
  target,
}: {
  weekStart: Date
  entries: Entry[]
  meals: number
  target: number | null
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const planned = entries.filter((e) => e.dish)
  const busyDays = days.filter((d) => planned.some((e) => e.date === iso(d))).length
  const average = busyDays ? Math.round(sum(planned, 'calories') / busyDays) : 0
  const dayKcal = days.map((d) => sum(planned.filter((e) => e.date === iso(d)), 'calories'))
  const top = Math.max(target ?? 0, ...dayKcal, 1)
  const averageFiber = busyDays ? Math.round((sum(planned, 'fiber_g') / busyDays) * 10) / 10 : 0

  return (
    <div className="print-only">
      <header className="print-hero">
        <span className="print-blob a" />
        <span className="print-blob b" />
        <div>
          <div className="print-logo">
            Mealoria<span>.</span>
          </div>
          <h1>{t('Меню на тиждень')}</h1>
        </div>
        <p className="print-dates">
          {fmtDate(iso(weekStart))} — {fmtDate(iso(addDays(weekStart, 6)))}
        </p>
      </header>
      <div className="print-summary">
        <div>
          <strong>{showEnergy(sum(planned, 'calories'))}</strong>
          <span>{t('{unit} за тиждень', { unit: energyUnit() })}</span>
        </div>
        <div>
          <strong>{showEnergy(average)}</strong>
          <span>{target ? t('{unit} на день, норма {n}', { n: showEnergy(target), unit: energyUnit() }) : t('{unit} на день', { unit: energyUnit() })}</span>
        </div>
        <div>
          <strong>{averageFiber}</strong>
          <span>{t('г клітковини на день')}</span>
        </div>
        <div>
          <strong>{planned.length}</strong>
          <span>{t('страв заплановано')}</span>
        </div>
      </div>

      <div className="print-chart">
        <span className="print-chart-title">
          {t('Калорії по днях')}
          {target ? <em> · {t('пунктир — ваша норма')}</em> : null}
        </span>
        <div className="print-bars">
          {dayKcal.map((kcal, i) => (
            <div key={i} className="print-bar">
              <span className="print-bar-value">{kcal ? showEnergy(kcal) : ''}</span>
              <span className="print-bar-track">
                <span className={`print-bar-fill${target && kcal > target ? ' over' : ''}`} style={{ height: `${(kcal / top) * 100}%` }} />
                {target ? <span className="print-bar-target" style={{ bottom: `${(target / top) * 100}%` }} /> : null}
              </span>
              <span className="print-bar-day">{t(SHORT_DAYS[i])}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="print-days">
        {days.map((d, i) => {
          const date = iso(d)
          const list = planned.filter((e) => e.date === date).sort((a, b) => a.slot - b.slot)
          return (
            <section key={date} className="print-day">
              <header>
                <span>
                  <strong>{t(FULL_DAYS[i])}</strong> {fmtShortDate(date)}
                </span>
                {list.length > 0 && <span className="print-kcal">{showEnergy(sum(list, 'calories'))} {energyUnit()}</span>}
              </header>
              {list.length === 0 ? (
                <p className="print-empty">{t('Нічого не заплановано')}</p>
              ) : (
                <>
                  <ul>
                    {list.map((e) => (
                      <li key={e.id}>
                        <small>{mealName(meals, e.slot)}</small>
                        <span>{e.dish?.name}</span>
                        <em>{e.dish?.calories != null ? `${showEnergy(e.dish.calories)} ${energyUnit()}` : ''}</em>
                      </li>
                    ))}
                  </ul>
                  <footer>
                    {macrosLine(sum(list, 'protein_g'), sum(list, 'fat_g'), sum(list, 'carbs_g'), sum(list, 'fiber_g'), true)}
                  </footer>
                </>
              )}
            </section>
          )
        })}
      </div>
      <p className="print-foot">
        <b>
          Mealoria<span>.</span>
        </b>{' '}
        {t('Створено в Mealoria')} · mealoria.mealoria.workers.dev
      </p>
    </div>
  )
}
