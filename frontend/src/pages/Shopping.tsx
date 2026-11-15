import { useEffect, useRef, useState, type FormEvent } from 'react'
import StatusLine from '../components/StatusLine'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import ServingsPicker from '../components/ServingsPicker'
import ShareList from '../components/ShareList'
import { addDays, fmtDate, iso, mondayOf } from '../dates'
import { scaleAmount, useServings } from '../servings'
import { food, foodSource, t } from '../i18n'
import { convertAmount } from '../units'
import { confetti } from '../effects'

type Item = { name: string; amount: string; checked: boolean }
type ShoppingResponse = { items: Item[]; at_home: string[] }
type PantryItem = { id: string; name: string }
type ManualItem = { id: string; name: string; checked: boolean }

const norm = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean).join(' ')
// Products for the "Already at home" quick buttons, grouped. The names are the ingredient names of the catalog
// (the list matches them exactly); a button with several names adds all of them.
const QUICK_GROUPS: { title: string; items: string[][] }[] = [
  {
    title: 'Бакалія',
    items: [['олія'], ['сіль'], ['цукор'], ['борошно'], ['рис'], ['гречка'], ['макарони'], ['вівсяні пластівці'], ['гранола'],
      ['цільнозерновий хліб'], ['житній хліб'], ['спеції'], ['томатна паста'], ['соєвий соус'], ['мед'], ['родзинки'],
      ['сочевиця'], ['нут консервований'], ['квасоля консервована'], ['томати в соку'], ['тунець консервований'],
      ['овочевий бульйон'], ['мигдаль'], ['волоські горіхи'], ['арахісова паста'], ['насіння чіа']],
  },
  {
    title: 'Молочне й яйця',
    items: [['яйця', 'яйце'], ['молоко'], ['вершкове масло'], ['твердий сир'], ['сир кисломолочний'], ['йогурт натуральний'],
      ['грецький йогурт'], ['сметана 15%'], ['вершки 10%'], ['кефір'], ['пармезан'], ['бринза']],
  },
  {
    title: 'Овочі й зелень',
    items: [['цибуля'], ['морква'], ['картопля'], ['часник'], ['помідор'], ['огірок'], ['солодкий перець'], ['кабачок'],
      ['капуста'], ['броколі'], ['шпинат'], ['баклажан'], ['гарбуз'], ['буряк'], ['печериці'], ['зелень (кріп, петрушка)'],
      ['листя салату'], ['авокадо']],
  },
  {
    title: 'Фрукти й ягоди',
    items: [['банан'], ['яблуко'], ['лимон'], ['лимонний сік'], ['ягоди'], ['ківі']],
  },
  {
    title: 'М’ясо й риба',
    items: [['куряче філе'], ['курячий фарш'], ['філе індички'], ['пісна свинина'], ['яловичина пісна'], ['шинка'],
      ['філе білої риби'], ['креветки']],
  },
]

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
    // "eggs" typed on the English site is saved as the catalogue's «яйця», so recipes still find it
    void addNames(newItem.split(/[,;\n]+/).map(foodSource))
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
  const totalCount = data.items.length + manual.length
  const boughtCount = done.length + manual.filter((m) => m.checked).length
  const allBought = totalCount > 0 && boughtCount === totalCount
  // confetti only when the last product gets ticked, not when a finished list is opened
  const wasAllBought = useRef<boolean | null>(null)
  useEffect(() => {
    if (status) {
      wasAllBought.current = null
      return
    }
    if (wasAllBought.current === false && allBought) confetti()
    wasAllBought.current = allBought
  }, [allBought, status])
  // what is still to buy, as lines of text for a chat message
  const toShare = [
    ...todo.map((i) => (i.amount ? `${food(i.name)} — ${convertAmount(scaleAmount(i.amount, servings))}` : food(i.name))),
    ...manual.filter((m) => !m.checked).map((m) => food(m.name)),
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
      <StatusLine text={status} />
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

      {totalCount > 0 && (
        <div className={`buy-progress${allBought ? ' all' : ''}`}>
          <div className="buy-progress-head">
            <strong>{allBought ? t('Усе куплено!') : t('Куплено {done} з {total}', { done: boughtCount, total: totalCount })}</strong>
            <span>{Math.round((boughtCount / totalCount) * 100)}%</span>
          </div>
          <div className="buy-meter" aria-hidden="true">
            <span style={{ width: `${(boughtCount / totalCount) * 100}%` }} />
          </div>
        </div>
      )}
      <ul className="cards shopping-list">
        {[
          ...todo.map((item) => ({ kind: 'plan' as const, item })),
          ...manual.filter((m) => !m.checked).map((item) => ({ kind: 'own' as const, item })),
          ...done.map((item) => ({ kind: 'plan' as const, item })),
          ...manual.filter((m) => m.checked).map((item) => ({ kind: 'own' as const, item })),
        ].map((row) =>
          row.kind === 'plan' ? (
            <li key={`p-${row.item.name}`} className={row.item.checked ? 'done' : undefined}>
              <label className="inline" style={{ margin: 0 }}>
                <input type="checkbox" checked={row.item.checked} onChange={() => toggle(row.item)} />{' '}
                <span className="item-text">
                  {food(row.item.name)}
                  {row.item.amount && ` — ${convertAmount(scaleAmount(row.item.amount, servings))}`}
                </span>
              </label>
              {!row.item.checked && (
                <button type="button" className="have-it" onClick={() => void addNames([row.item.name])}>
                  {t('Є вдома')}
                </button>
              )}
            </li>
          ) : (
            <li key={`m-${row.item.id}`} className={row.item.checked ? 'done' : undefined}>
              <label className="inline" style={{ margin: 0 }}>
                <input type="checkbox" checked={row.item.checked} onChange={() => void toggleManual(row.item)} />{' '}
                <span className="item-text">{food(row.item.name)}</span>
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
      {QUICK_GROUPS.map((group) => {
        const left = group.items.filter((names) => !names.every((n) => pantry.some((p) => norm(p.name) === n)))
        if (!left.length) return null
        return (
          <div className="quick" key={group.title}>
            <small className="muted">{t(group.title)}:</small>
            {left.map((names) => (
              <button key={names[0]} type="button" className="chip-btn" onClick={() => void addNames(names)}>
                + {food(names[0])}
              </button>
            ))}
          </div>
        )
      })}
      <div className="pantry">
        {pantry.map((p) => (
          <span key={p.id} className="chip">
            {food(p.name)}{' '}
            <button type="button" aria-label={t('Прибрати зі списку «вже є вдома»')} onClick={() => removePantry(p.id)}>
              ×
            </button>
          </span>
        ))}
      </div>
      {data.at_home.length > 0 && <p>{t('У цьому тижні вже є вдома: {list}.', { list: data.at_home.map(food).join(', ') })}</p>}
    </div>
  )
}
