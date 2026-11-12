import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import ServingsPicker from '../components/ServingsPicker'
import ShareList from '../components/ShareList'
import { addDays, fmtDate, iso, mondayOf } from '../dates'
import { scaleAmount, useServings } from '../servings'
import { t } from '../i18n'
import { convertAmount } from '../units'

type Item = { name: string; amount: string; checked: boolean }
type ShoppingResponse = { items: Item[]; at_home: string[] }
type PantryItem = { id: string; name: string }
type ManualItem = { id: string; name: string; checked: boolean }

const norm = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean).join(' ')
// Products that most kitchens already have; the names match the ingredient names of the catalog
const QUICK = ['сіль', 'цукор', 'олія', 'борошно', 'перець', 'яйця', 'молоко', 'масло вершкове', 'цибуля', 'часник', 'картопля', 'рис', 'гречка', 'макарони']

export default function Shopping() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [data, setData] = useState<ShoppingResponse>({ items: [], at_home: [] })
  const [pantry, setPantry] = useState<PantryItem[]>([])
  const [manual, setManual] = useState<ManualItem[]>([])
  const [extra, setExtra] = useState('')
  const [newItem, setNewItem] = useState('')
  const [status, setStatus] = useState(t('Завантаження…'))
  const [version, setVersion] = useState(0)
  const [servings, setServings] = useServings()

  const start = iso(weekStart)

  useEffect(() => {
    let current = true
    Promise.all([
      apiFetch<ShoppingResponse>(`/api/shopping?start=${start}`),
      apiFetch<PantryItem[]>('/api/shopping/pantry'),
      apiFetch<ManualItem[]>('/api/shopping/manual').catch(() => [] as ManualItem[]),
    ])
      .then(([list, home, own]) => {
        if (!current) return
        setData(list)
        setPantry(home)
        setManual(own)
        setStatus('')
      })
      .catch(() => current && setStatus(t('Не вдалося завантажити список')))
    return () => {
      current = false
    }
  }, [start, version])

  function goToWeek(date: Date) {
    setStatus(t('Завантаження…'))
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
      setStatus(t('Не вдалося зберегти позначку'))
    }
  }

  const json = { 'Content-Type': 'application/json' }

  /** Adds products to the list by hand; they appear at once and are saved in the background. */
  async function addManual(e: FormEvent) {
    e.preventDefault()
    const names = extra.split(/[,;\n]+/).map((n) => n.trim().replace(/\s+/g, ' ')).filter((n) => n && n.length <= 100)
    if (!names.length) return
    setExtra('')
    setManual((m) => [...m, ...names.map((name) => ({ id: `tmp-${name}-${m.length}`, name, checked: false }))])
    try {
      setManual(
        await apiFetch<ManualItem[]>('/api/shopping/manual', {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ names }),
        }),
      )
    } catch {
      setStatus(t('Не вдалося додати до списку'))
      setVersion((v) => v + 1)
    }
  }

  async function toggleManual(item: ManualItem) {
    if (item.id.startsWith('tmp-')) return
    setManual((m) => m.map((x) => (x.id === item.id ? { ...x, checked: !item.checked } : x)))
    try {
      await apiFetch<void>(`/api/shopping/manual/${item.id}`, {
        method: 'PATCH',
        headers: json,
        body: JSON.stringify({ checked: !item.checked }),
      })
    } catch {
      setManual((m) => m.map((x) => (x.id === item.id ? { ...x, checked: item.checked } : x)))
      setStatus(t('Не вдалося оновити позначку'))
    }
  }

  async function removeManual(id: string) {
    if (id.startsWith('tmp-')) return
    setManual((m) => m.filter((x) => x.id !== id))
    try {
      await apiFetch<void>(`/api/shopping/manual/${id}`, { method: 'DELETE' })
    } catch {
      setStatus(t('Не вдалося прибрати продукт'))
      setVersion((v) => v + 1)
    }
  }

  async function clearBought() {
    setManual((m) => m.filter((x) => !x.checked))
    try {
      await apiFetch<void>('/api/shopping/manual', { method: 'DELETE' })
    } catch {
      setStatus(t('Не вдалося прибрати продукт'))
      setVersion((v) => v + 1)
    }
  }

  /** Adds products to "already at home": the screen updates at once, the server catches up. */
  async function addNames(raw: string[]) {
    const have = new Set(pantry.map((p) => norm(p.name)))
    const names = [...new Set(raw.map(norm).filter((n) => n && n.length <= 100 && !have.has(n)))]
    if (!names.length) return
    setData((d) => ({
      items: d.items.filter((i) => !names.includes(norm(i.name))),
      at_home: [...d.at_home, ...d.items.filter((i) => names.includes(norm(i.name))).map((i) => i.name)],
    }))
    setPantry((p) =>
      [...p, ...names.map((name) => ({ id: `tmp-${name}`, name }))].sort((a, b) => a.name.localeCompare(b.name)),
    )
    try {
      setPantry(
        await apiFetch<PantryItem[]>('/api/shopping/pantry/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names }),
        }),
      )
    } catch {
      setStatus(t('Не вдалося додати продукт'))
      setVersion((v) => v + 1)
    }
  }

  function addPantry(e: FormEvent) {
    e.preventDefault()
    void addNames(newItem.split(/[,;\n]+/))
    setNewItem('')
  }

  async function removePantry(id: string) {
    if (id.startsWith('tmp-')) return // still being saved
    setPantry((p) => p.filter((x) => x.id !== id))
    try {
      await apiFetch<void>(`/api/shopping/pantry/${id}`, { method: 'DELETE' })
      setVersion((v) => v + 1) // the product comes back into the list
    } catch {
      setStatus(t('Не вдалося прибрати продукт'))
      setVersion((v) => v + 1)
    }
  }

  const todo = data.items.filter((i) => !i.checked)
  const done = data.items.filter((i) => i.checked)
  // what is still to buy, as lines of text for a chat message
  const toShare = [
    ...todo.map((i) => (i.amount ? `${i.name} — ${convertAmount(scaleAmount(i.amount, servings))}` : i.name)),
    ...manual.filter((m) => !m.checked).map((m) => m.name),
  ]

  return (
    <div>
      <h1>{t('Список продуктів')}</h1>
      <div className="week-nav">
        <button onClick={() => goToWeek(addDays(weekStart, -7))}>←</button>
        <strong>
          {fmtDate(start)} — {fmtDate(iso(addDays(weekStart, 6)))}
        </strong>
        <button onClick={() => goToWeek(addDays(weekStart, 7))}>→</button>
        <button onClick={() => goToWeek(mondayOf(new Date()))}>{t('Сьогодні')}</button>
      </div>
      <ServingsPicker value={servings} onChange={setServings} />
      {status && <p className="status">{status}</p>}
      <form onSubmit={addManual} className="actions" style={{ margin: '4px 0 14px' }}>
        <input placeholder={t('Додати до списку: молоко 2 л, хліб')} value={extra} maxLength={300} style={{ maxWidth: 360 }}
          onChange={(e) => setExtra(e.target.value)} />
        <button type="submit">{t('Додати')}</button>
      </form>
      {!status && data.items.length === 0 && manual.length === 0 && data.at_home.length === 0 && (
        <p>
          {t('Список порожній. Додайте продукт вище або страви з інгредієнтами в')} <Link to="/calendar">{t('календар')}</Link>.
        </p>
      )}

      <ul className="cards">
        {[
          ...todo.map((item) => ({ kind: 'plan' as const, item })),
          ...manual.filter((m) => !m.checked).map((item) => ({ kind: 'own' as const, item })),
          ...done.map((item) => ({ kind: 'plan' as const, item })),
          ...manual.filter((m) => m.checked).map((item) => ({ kind: 'own' as const, item })),
        ].map((row) =>
          row.kind === 'plan' ? (
            <li key={`p-${row.item.name}`} style={{ textDecoration: row.item.checked ? 'line-through' : undefined, opacity: row.item.checked ? 0.6 : 1 }}>
              <label className="inline" style={{ margin: 0 }}>
                <input type="checkbox" checked={row.item.checked} onChange={() => toggle(row.item)} /> {row.item.name}
                {row.item.amount && ` — ${convertAmount(scaleAmount(row.item.amount, servings))}`}
              </label>
              {!row.item.checked && (
                <button type="button" className="have-it" onClick={() => void addNames([row.item.name])}>
                  {t('Є вдома')}
                </button>
              )}
            </li>
          ) : (
            <li key={`m-${row.item.id}`} style={{ textDecoration: row.item.checked ? 'line-through' : undefined, opacity: row.item.checked ? 0.6 : 1 }}>
              <label className="inline" style={{ margin: 0 }}>
                <input type="checkbox" checked={row.item.checked} onChange={() => void toggleManual(row.item)} /> {row.item.name}
              </label>
              <button type="button" className="have-it" aria-label={t('Прибрати з списку')} title={t('Додано вручну')} onClick={() => void removeManual(row.item.id)}>
                ×
              </button>
            </li>
          ),
        )}
      </ul>
      <ShareList
        title={t('Список продуктів: {from} — {to}', { from: fmtDate(start), to: fmtDate(iso(addDays(weekStart, 6))) })}
        lines={toShare}
      />
      {manual.some((m) => m.checked) && (
        <p>
          <button type="button" onClick={() => void clearBought()}>
            {t('Прибрати куплені')}
          </button>
        </p>
      )}

      <h2>{t('Вже є вдома')}</h2>
      <p className="muted">
        {t('Додайте те, що вже є в холодильнику й на кухні: ці продукти не потраплять до списку. Можна кілька через кому або одним дотиком нижче.')}
      </p>
      <form onSubmit={addPantry} className="actions" style={{ marginBottom: 12 }}>
        <input placeholder={t('Кілька через кому: сіль, цукор, олія')} value={newItem} maxLength={300} style={{ maxWidth: 360 }}
          onChange={(e) => setNewItem(e.target.value)} />
        <button type="submit">{t('Додати')}</button>
      </form>
      {QUICK.some((q) => !pantry.some((p) => norm(p.name) === q)) && (
        <div className="quick">
          <small className="muted">{t('Швидко додати:')}</small>
          {QUICK.filter((q) => !pantry.some((p) => norm(p.name) === q)).map((q) => (
            <button key={q} type="button" className="chip-btn" onClick={() => void addNames([q])}>
              + {q}
            </button>
          ))}
        </div>
      )}
      <div className="pantry">
        {pantry.map((p) => (
          <span key={p.id} className="chip">
            {p.name}{' '}
            <button type="button" aria-label={t('Прибрати зі списку «вже є вдома»')} onClick={() => removePantry(p.id)}>
              ×
            </button>
          </span>
        ))}
      </div>
      {data.at_home.length > 0 && <p>{t('У цьому тижні вже є вдома: {list}.', { list: data.at_home.join(', ') })}</p>}
    </div>
  )
}
