import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { addDays, iso, mondayOf } from '../dates'

type Item = { name: string; amount: string; checked: boolean }
type ShoppingResponse = { items: Item[]; at_home: string[] }
type PantryItem = { id: string; name: string }

export default function Shopping() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [data, setData] = useState<ShoppingResponse>({ items: [], at_home: [] })
  const [pantry, setPantry] = useState<PantryItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [status, setStatus] = useState('Завантаження…')
  const [version, setVersion] = useState(0)

  const start = iso(weekStart)

  useEffect(() => {
    let current = true
    Promise.all([
      apiFetch<ShoppingResponse>(`/api/shopping?start=${start}`),
      apiFetch<PantryItem[]>('/api/shopping/pantry'),
    ])
      .then(([list, home]) => {
        if (!current) return
        setData(list)
        setPantry(home)
        setStatus('')
      })
      .catch(() => current && setStatus('Не вдалося завантажити список'))
    return () => {
      current = false
    }
  }, [start, version])

  function goToWeek(date: Date) {
    setStatus('Завантаження…')
    setWeekStart(date)
  }

  async function toggle(item: Item) {
    const checked = !item.checked
    setData((d) => ({
      ...d,
      items: d.items.map((i) => (i.name === item.name ? { ...i, checked } : i)),
    }))
    try {
      await apiFetch<void>('/api/shopping/check', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, name: item.name, checked }),
      })
    } catch {
      setStatus('Не вдалося зберегти позначку')
    }
  }

  async function addPantry(e: FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    try {
      await apiFetch<PantryItem[]>('/api/shopping/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItem }),
      })
      setNewItem('')
      setVersion((v) => v + 1)
    } catch {
      setStatus('Не вдалося додати продукт')
    }
  }

  async function removePantry(id: string) {
    try {
      await apiFetch<void>(`/api/shopping/pantry/${id}`, { method: 'DELETE' })
      setVersion((v) => v + 1)
    } catch {
      setStatus('Не вдалося прибрати продукт')
    }
  }

  const todo = data.items.filter((i) => !i.checked)
  const done = data.items.filter((i) => i.checked)

  return (
    <div>
      <h1>Список продуктів</h1>
      <div className="week-nav">
        <button onClick={() => goToWeek(addDays(weekStart, -7))}>←</button>
        <strong>
          {start} — {iso(addDays(weekStart, 6))}
        </strong>
        <button onClick={() => goToWeek(addDays(weekStart, 7))}>→</button>
        <button onClick={() => goToWeek(mondayOf(new Date()))}>Сьогодні</button>
      </div>
      {status && <p className="status">{status}</p>}
      {!status && data.items.length === 0 && data.at_home.length === 0 && (
        <p>
          Список порожній. Додайте страви з інгредієнтами в <Link to="/">календар</Link>.
        </p>
      )}

      <ul className="cards">
        {[...todo, ...done].map((i) => (
          <li key={i.name} style={{ textDecoration: i.checked ? 'line-through' : undefined, opacity: i.checked ? 0.6 : 1 }}>
            <label className="inline" style={{ margin: 0 }}>
              <input type="checkbox" checked={i.checked} onChange={() => toggle(i)} /> {i.name}
              {i.amount && ` — ${i.amount}`}
            </label>
          </li>
        ))}
      </ul>

      <h2>Вже є вдома</h2>
      <p className="muted">Ці продукти не потраплять до списку.</p>
      <form onSubmit={addPantry} className="actions" style={{ marginBottom: 12 }}>
        <input placeholder="Наприклад, сіль" value={newItem} maxLength={100} style={{ maxWidth: 280 }}
          onChange={(e) => setNewItem(e.target.value)} />
        <button type="submit">Додати</button>
      </form>
      <ul className="cards">
        {pantry.map((p) => (
          <li key={p.id}>
            {p.name} <button onClick={() => removePantry(p.id)}>×</button>
          </li>
        ))}
      </ul>
      {data.at_home.length > 0 && <p>У цьому тижні вже є вдома: {data.at_home.join(', ')}.</p>}
    </div>
  )
}
