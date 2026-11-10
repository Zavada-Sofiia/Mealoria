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
import { addDays, iso, mondayOf, pad } from '../dates'

type Dish = { id: string; name: string; calories: number | null }
type Entry = { id: string; date: string; slot: number; dish: Dish | null }
type ProfileResponse = {
  profile: { meals_per_day: number; target_calories: number | null } | null
  recommended_calories: number | null
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const MEAL_NAMES: Record<number, string[]> = {
  1: ['Їжа'],
  2: ['Сніданок', 'Вечеря'],
  3: ['Сніданок', 'Обід', 'Вечеря'],
  4: ['Сніданок', 'Обід', 'Перекус', 'Вечеря'],
  5: ['Сніданок', 'Перекус', 'Обід', 'Перекус', 'Вечеря'],
}

const mealName = (count: number, slot: number) => MEAL_NAMES[count]?.[slot] ?? `Прийом ${slot + 1}`

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
    <td
      ref={setNodeRef}
      style={{
        verticalAlign: 'top',
        minWidth: 110,
        height: 64,
        border: '1px solid #8884',
        background: isOver ? '#8882' : undefined,
      }}
    >
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
        setDishes(d)
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

  function goToWeek(date: Date) {
    setStatus('Завантаження…')
    setWeekStart(date)
  }

  async function onDragEnd(e: DragEndEvent) {
    if (!e.over) return
    const [, date, slot] = String(e.over.id).split(':')
    const [kind, id] = String(e.active.id).split(':')
    const json = { 'Content-Type': 'application/json' }
    try {
      if (kind === 'dish') {
        const created = await apiFetch<Entry>('/api/calendar', {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ date, slot: Number(slot), dish_id: id }),
        })
        setEntries((es) => [...es, created])
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
  const dayCalories = (date: string) =>
    entries.filter((e) => e.date === date).reduce((sum, e) => sum + (e.dish?.calories ?? 0), 0)

  return (
    <div>
      <h1>Календар</h1>
      {!hasProfile && (
        <p>
          Кількість прийомів їжі береться з <Link to="/profile">профілю</Link>. Поки що показано 3.
        </p>
      )}
      <p>
        <button onClick={() => goToWeek(addDays(weekStart, -7))}>← Тиждень</button>{' '}
        {iso(weekStart)} — {iso(addDays(weekStart, 6))}{' '}
        <button onClick={() => goToWeek(addDays(weekStart, 7))}>Тиждень →</button>{' '}
        <button onClick={() => goToWeek(mondayOf(new Date()))}>Сьогодні</button>
      </p>
      {status && <p>{status}</p>}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div>
          <strong>Мої страви</strong> (перетягніть у клітинку):
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 16px' }}>
            {dishes.map((d) => (
              <Draggable key={d.id} id={`dish:${d.id}`}>
                <span style={{ border: '1px solid #8886', borderRadius: 6, padding: '4px 8px' }}>
                  {d.name}
                  {d.calories != null && ` · ${d.calories}`}
                </span>
              </Draggable>
            ))}
            {dishes.length === 0 && <Link to="/dishes">Додайте першу страву</Link>}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th />
                {days.map((d, i) => (
                  <th key={iso(d)}>
                    {DAY_NAMES[i]} {pad(d.getDate())}.{pad(d.getMonth() + 1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: meals }, (_, slot) => (
                <tr key={slot}>
                  <th>{mealName(meals, slot)}</th>
                  {days.map((d) => {
                    const date = iso(d)
                    return (
                      <Cell key={date} id={`cell:${date}:${slot}`}>
                        {entries
                          .filter((e) => e.date === date && e.slot === slot)
                          .map((e) => (
                            <Draggable key={e.id} id={`entry:${e.id}`}>
                              <div>
                                {e.dish?.name ?? '—'}{' '}
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
                      </Cell>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Калорії</th>
                {days.map((d) => {
                  const total = dayCalories(iso(d))
                  return (
                    <td key={iso(d)} style={{ textAlign: 'center' }}>
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
    </div>
  )
}
