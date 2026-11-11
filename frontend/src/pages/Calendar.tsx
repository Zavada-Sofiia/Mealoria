import { useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { addDays, fmtDate, iso, mondayOf, pad } from '../dates'
import { mealName } from '../meals'
import PrintableWeek from '../components/PrintableWeek'
import { download, weekToIcs } from '../ics'

type Dish = {
  id: string
  name: string
  calories: number | null
  protein_g?: number | null
  fat_g?: number | null
  carbs_g?: number | null
  favorite?: boolean
}
type Entry = { id: string; date: string; slot: number; dish: Dish | null }
type ProfileResponse = {
  profile: { meals_per_day: number; target_calories: number | null } | null
  recommended_calories: number | null
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const MOBILE = '(max-width: 760px)'
const todayIndex = () => (new Date().getDay() + 6) % 7

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

function Draggable({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        touchAction: 'none',
        cursor: 'grab',
        opacity: isDragging ? 0.6 : 1,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {children}
    </div>
  )
}

function Cell({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <td ref={setNodeRef} className={isOver ? 'drop-over' : undefined}>
      {children}
    </td>
  )
}

export default function Calendar() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [entries, setEntries] = useState<Entry[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])
  const [meals, setMeals] = useState(3)
  const [target, setTarget] = useState<number | null>(null)
  const [hasProfile, setHasProfile] = useState(true)
  const [status, setStatus] = useState('Завантаження…')
  const mobile = useIsMobile()
  const [dayIdx, setDayIdx] = useState(todayIndex)
  const [picking, setPicking] = useState<{ date: string; slot: number } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  )

  useEffect(() => {
    Promise.all([
      apiFetch<Dish[]>('/api/dishes'),
      apiFetch<ProfileResponse>('/api/profile'),
    ])
      .then(([d, p]) => {
        setDishes([...d].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite)))
        setHasProfile(p.profile !== null)
        setMeals(p.profile?.meals_per_day ?? 3)
        setTarget(p.profile?.target_calories ?? p.recommended_calories)
      })
      .catch(() => setStatus('Не вдалося завантажити дані'))
  }, [])

  useEffect(() => {
    let current = true
    apiFetch<Entry[]>(`/api/calendar?start=${iso(weekStart)}`)
      .then((e) => {
        if (!current) return
        setEntries(e)
        setStatus('')
      })
      .catch(() => current && setStatus('Не вдалося завантажити тиждень'))
    return () => {
      current = false
    }
  }, [weekStart])

  function goToWeek(date: Date, day = date.getTime() === mondayOf(new Date()).getTime() ? todayIndex() : 0) {
    setStatus('Завантаження…')
    setWeekStart(date)
    setDayIdx(day)
  }

  function shiftDay(delta: number) {
    const next = dayIdx + delta
    if (next < 0) goToWeek(addDays(weekStart, -7), 6)
    else if (next > 6) goToWeek(addDays(weekStart, 7), 0)
    else setDayIdx(next)
  }

  async function copyPreviousWeek() {
    setStatus('Копіюємо минулий тиждень…')
    try {
      setEntries(await apiFetch<Entry[]>(`/api/calendar/copy-week?start=${iso(weekStart)}`, { method: 'POST' }))
      setStatus('')
    } catch {
      setStatus('Не вдалося скопіювати тиждень')
    }
  }

  async function place(date: string, slot: number, dishId: string) {
    const json = { 'Content-Type': 'application/json' }
    try {
      const created = await apiFetch<Entry>('/api/calendar', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ date, slot, dish_id: dishId }),
      })
      setEntries((es) => [...es, created])
    } catch {
      setStatus('Не вдалося зберегти зміну')
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    if (!e.over) return
    const [, date, slot] = String(e.over.id).split(':')
    const [kind, id] = String(e.active.id).split(':')
    const json = { 'Content-Type': 'application/json' }
    try {
      if (kind === 'dish') {
        await place(date, Number(slot), id)
      } else {
        const moved = await apiFetch<Entry>(`/api/calendar/${id}`, {
          method: 'PUT',
          headers: json,
          body: JSON.stringify({ date, slot: Number(slot) }),
        })
        setEntries((es) => es.map((x) => (x.id === id ? moved : x)))
      }
    } catch {
      setStatus('Не вдалося зберегти зміну')
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch<void>(`/api/calendar/${id}`, { method: 'DELETE' })
      setEntries((es) => es.filter((x) => x.id !== id))
    } catch {
      setStatus('Не вдалося видалити')
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const planned = entries.filter((e) => e.dish)
  const exportIcs = () =>
    download(`mealoria-${iso(weekStart)}.ics`, weekToIcs(planned, meals), 'text/calendar;charset=utf-8')
  const shown = mobile ? [days[dayIdx]] : days
  const dayCalories = (date: string) =>
    entries.filter((e) => e.date === date).reduce((sum, e) => sum + (e.dish?.calories ?? 0), 0)

  return (
    <div>
      <div className="no-print">
      <h1>Календар</h1>
      {!hasProfile && (
        <p>
          Кількість прийомів їжі береться з <Link to="/profile">профілю</Link>. Поки що показано 3.
        </p>
      )}
      {mobile ? (
        <>
          <div className="week-nav day-nav">
            <button onClick={() => shiftDay(-1)} aria-label="Попередній день">
              ←
            </button>
            <strong>
              {DAY_NAMES[dayIdx]}, {pad(days[dayIdx].getDate())}.{pad(days[dayIdx].getMonth() + 1)}
            </strong>
            <button onClick={() => shiftDay(1)} aria-label="Наступний день">
              →
            </button>
            <button className="secondary" onClick={() => goToWeek(mondayOf(new Date()))}>
              Сьогодні
            </button>
          </div>
          <div className="day-strip">
            {days.map((d, i) => {
              const date = iso(d)
              return (
                <button
                  key={date}
                  type="button"
                  className={`${i === dayIdx ? 'on' : ''}${entries.some((e) => e.date === date) ? ' has' : ''}`}
                  onClick={() => setDayIdx(i)}
                >
                  <small>{DAY_NAMES[i]}</small>
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="week-nav">
          <button onClick={() => goToWeek(addDays(weekStart, -7))}>←</button>
          <strong>
            {fmtDate(iso(weekStart))} — {fmtDate(iso(addDays(weekStart, 6)))}
          </strong>
          <button onClick={() => goToWeek(addDays(weekStart, 7))}>→</button>
          <button onClick={() => goToWeek(mondayOf(new Date()))}>Сьогодні</button>
        </div>
      )}
      {status && <p className="status">{status}</p>}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className={mobile ? 'palette-wrap mobile' : 'palette-wrap'}>
          <strong>Мої страви</strong> {mobile ? '(або натисніть «+» у клітинці)' : '(перетягніть у клітинку):'}
          <div className="palette">
            {dishes.map((d) => (
              <Draggable key={d.id} id={`dish:${d.id}`}>
                <span className="chip">
                  {d.favorite && '★ '}
                  {d.name}
                  {d.calories != null && ` · ${d.calories}`}
                </span>
              </Draggable>
            ))}
            {dishes.length === 0 && <Link to="/dishes">Додайте першу страву</Link>}
          </div>
        </div>

        <div className="week-scroll">
          <table className={mobile ? 'week single' : 'week'}>
            <thead>
              <tr>
                <th />
                {shown.map((d) => (
                  <th key={iso(d)}>
                    {DAY_NAMES[(d.getDay() + 6) % 7]} {pad(d.getDate())}.{pad(d.getMonth() + 1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: meals }, (_, slot) => (
                <tr key={slot}>
                  <th>{mealName(meals, slot)}</th>
                  {shown.map((d) => {
                    const date = iso(d)
                    return (
                      <Cell key={date} id={`cell:${date}:${slot}`}>
                        {entries
                          .filter((e) => e.date === date && e.slot === slot)
                          .map((e) => (
                            <Draggable key={e.id} id={`entry:${e.id}`}>
                              <div className="entry">
                                <span>{e.dish?.name ?? '—'}</span>
                                <button
                                  onPointerDown={(ev) => ev.stopPropagation()}
                                  onClick={() => remove(e.id)}
                                  aria-label="Прибрати"
                                >
                                  ×
                                </button>
                              </div>
                            </Draggable>
                          ))}
                        {mobile && dishes.length > 0 && (
                          <button
                            type="button"
                            className="add-entry"
                            onClick={() => setPicking({ date, slot })}
                          >
                            + Додати
                          </button>
                        )}
                      </Cell>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Калорії</th>
                {shown.map((d) => {
                  const total = dayCalories(iso(d))
                  return (
                    <td key={iso(d)}>
                      {total}
                      {target ? ` / ${target}` : ''}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </DndContext>

      <div className="actions" style={{ marginTop: 16 }}>
        <button type="button" onClick={copyPreviousWeek}>
          Повторити минулий тиждень
        </button>
        <button type="button" onClick={() => window.print()} disabled={planned.length === 0}>
          Друк / PDF
        </button>
        <button type="button" onClick={exportIcs} disabled={planned.length === 0}>
          Додати в Google/Apple Календар (.ics)
        </button>
      </div>
      </div>

      <PrintableWeek weekStart={weekStart} entries={entries} meals={meals} target={target} />

      {picking && (
        <>
          <div className="sheet-backdrop" onClick={() => setPicking(null)} />
          <div className="sheet" role="dialog" aria-label="Обрати страву">
            <h3>{mealName(meals, picking.slot)}: обрати страву</h3>
            {dishes.map((d) => (
              <button
                key={d.id}
                type="button"
                className="sheet-item"
                onClick={() => {
                  void place(picking.date, picking.slot, d.id)
                  setPicking(null)
                }}
              >
                {d.favorite && '★ '}
                {d.name}
                {d.calories != null && <small>{d.calories} ккал</small>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
