import { addDays, fmtDate, iso } from '../dates'
import { mealName } from '../meals'
import { t } from '../i18n'
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
  const averageFiber = busyDays ? Math.round((sum(planned, 'fiber_g') / busyDays) * 10) / 10 : 0

  return (
    <div className="print-only">
      <img className="print-banner" src="/print-header.jpg" alt="Mealoria" />
      <div className="print-title">
        <h1>{t('Меню на тиждень')}</h1>
        <p>
          {fmtDate(iso(weekStart))} — {fmtDate(iso(addDays(weekStart, 6)))}
        </p>
      </div>
      <div className="print-summary">
        <div>
          <strong>{sum(planned, 'calories')}</strong>
          <span>{t('ккал за тиждень')}</span>
        </div>
        <div>
          <strong>{average}</strong>
          <span>{target ? t('ккал на день, норма {n}', { n: target }) : t('ккал на день')}</span>
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

      <div className="print-days">
        {days.map((d, i) => {
          const date = iso(d)
          const list = planned.filter((e) => e.date === date).sort((a, b) => a.slot - b.slot)
          return (
            <section key={date} className="print-day">
              <header>
                <span>
                  <strong>{t(FULL_DAYS[i])}</strong> {fmtDate(date).slice(0, 5)}
                </span>
                {list.length > 0 && <span>{sum(list, 'calories')} {t('ккал')}</span>}
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
                        <em>{e.dish?.calories != null ? `${e.dish.calories} ${t('ккал')}` : ''}</em>
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
      <p className="print-foot">{t('Створено в Mealoria')} · mealoria.mealoria.workers.dev</p>
    </div>
  )
}
