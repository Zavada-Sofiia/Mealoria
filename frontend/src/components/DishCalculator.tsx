import { useState, type FormEvent } from 'react'
import { ApiError, apiFetch } from '../api/client'
import BarcodeScanner from './BarcodeScanner'
import StatusLine from './StatusLine'
import { t } from '../i18n'
import { macrosLine } from '../macros'
import { energyUnit, gramUnit, showEnergy, showGrams, storeEnergy, storeGrams } from '../units'

type Food = {
  name: string
  kcal_100g: number
  protein_100g: number
  fat_100g: number
  carbs_100g: number
  fiber_100g?: number
}
type Line = Food & { grams: number }

const round = (n: number) => Math.round(n * 10) / 10

/** Adds up products (search, barcode or typed by hand) into a dish and saves it to «Мої страви». */
export default function DishCalculator({ onSaved }: { onSaved?: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [servings, setServings] = useState(1)
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')
  const [scanning, setScanning] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', fat: '', carbs: '', fiber: '' })
  const canScan = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  async function findByBarcode(code: string) {
    setScanning(false)
    setStatus(t('Шукаємо…'))
    try {
      const food = await apiFetch<Food>(`/api/calories/barcode/${code}`)
      setResults([food])
      setStatus('')
    } catch (err) {
      setResults([])
      if (err instanceof ApiError && err.status === 404) {
        setStatus(t('Продукт зі штрихкодом {code} не знайдено в базі. Додайте його вручну нижче.', { code }))
        setManualOpen(true)
      } else if (err instanceof ApiError && err.status === 422) {
        setStatus(t('Продукт є в базі, але без калорій. Додайте його вручну нижче.'))
        setManualOpen(true)
      } else {
        setStatus(t('База продуктів зараз недоступна, спробуйте за хвилину'))
      }
    }
  }

  function addManual(e: FormEvent) {
    e.preventDefault()
    const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0)
    if (!manual.name.trim() || manual.kcal.trim() === '') return
    setLines([
      ...lines,
      {
        name: manual.name.trim().slice(0, 100),
        kcal_100g: storeEnergy(num(manual.kcal)),
        protein_100g: num(manual.protein),
        fat_100g: num(manual.fat),
        carbs_100g: num(manual.carbs),
        fiber_100g: num(manual.fiber),
        grams: 100,
      },
    ])
    setManual({ name: '', kcal: '', protein: '', fat: '', carbs: '', fiber: '' })
    setManualOpen(false)
    setStatus('')
  }

  async function search(e: FormEvent) {
    e.preventDefault()
    if (query.trim().length < 2) return
    setStatus(t('Шукаємо…'))
    try {
      const r = await apiFetch<Food[]>(`/api/calories/food?q=${encodeURIComponent(query)}`)
      setResults(r)
      setStatus(r.length ? '' : t('Нічого не знайдено. Спробуйте іншу назву українською'))
    } catch {
      setStatus(t('База продуктів зараз недоступна, спробуйте за хвилину'))
    }
  }

  const sum = (pick: (l: Line) => number) =>
    round(lines.reduce((s, l) => s + (pick(l) * l.grams) / 100, 0) / servings)
  const kcal = Math.round(sum((l) => l.kcal_100g))
  const protein = sum((l) => l.protein_100g)
  const fat = sum((l) => l.fat_100g)
  const carbs = sum((l) => l.carbs_100g)
  const fiber = sum((l) => l.fiber_100g ?? 0)

  async function saveDish() {
    if (!name.trim() || lines.length === 0) return
    try {
      await apiFetch('/api/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          calories: kcal,
          protein_g: protein,
          fat_g: fat,
          carbs_g: carbs,
          fiber_g: fiber || null,
          servings,
          ingredients: lines.map((l) => ({ name: l.name.slice(0, 100), amount: `${l.grams} ${t('г')}` })),
        }),
      })
      setLines([])
      setName('')
      setServings(1)
      setStatus(t('Страву збережено в «Мої страви»'))
      onSaved?.()
    } catch {
      setStatus(t('Не вдалося зберегти страву'))
    }
  }

  return (
    <section className="card red" id="dish-calc">
      <h2 style={{ marginTop: 0 }}>{t('Калькулятор страви')}</h2>
      <form onSubmit={search} className="actions" style={{ marginBottom: 12 }}>
        <input placeholder={t('Продукт, наприклад гречка')} value={query} style={{ maxWidth: 320 }}
          onChange={(e) => setQuery(e.target.value)} />
        <button type="submit">{t('Знайти')}</button>
        {canScan && <button type="button" onClick={() => setScanning(true)}>{t('Сканувати')}</button>}
      </form>
      {scanning && <BarcodeScanner onCode={(c) => void findByBarcode(c)} onClose={() => setScanning(false)} />}
      <StatusLine text={status} />

      <ul className="cards">
        {results.map((f) => (
          <li key={f.name}>
            {t('{name} · {n} {unit} / 100 г', { name: f.name, n: showEnergy(f.kcal_100g), unit: energyUnit() })}{' '}
            <button onClick={() => setLines([...lines, { ...f, grams: 100 }])}>{t('Додати')}</button>
          </li>
        ))}
      </ul>

      <details open={manualOpen} onToggle={(e) => setManualOpen((e.target as HTMLDetailsElement).open)} style={{ margin: '10px 0' }}>
        <summary>{t('Додати продукт вручну')}</summary>
        <form onSubmit={addManual} style={{ marginTop: 8 }}>
          <div className="row">
            <label>
              {t('Назва')}
              <input value={manual.name} maxLength={100} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
            </label>
            <label>
              {t('{unit} на 100 г', { unit: energyUnit() })}
              <input inputMode="decimal" value={manual.kcal} onChange={(e) => setManual({ ...manual, kcal: e.target.value })} />
            </label>
          </div>
          <div className="row">
            <label>
              {t('Білки, г')}
              <input inputMode="decimal" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })} />
            </label>
            <label>
              {t('Жири, г')}
              <input inputMode="decimal" value={manual.fat} onChange={(e) => setManual({ ...manual, fat: e.target.value })} />
            </label>
            <label>
              {t('Вуглеводи, г')}
              <input inputMode="decimal" value={manual.carbs} onChange={(e) => setManual({ ...manual, carbs: e.target.value })} />
            </label>
            <label>
              {t('Клітковина, г')}
              <input inputMode="decimal" value={manual.fiber} onChange={(e) => setManual({ ...manual, fiber: e.target.value })} />
            </label>
          </div>
          <button type="submit" disabled={!manual.name.trim() || manual.kcal.trim() === ''}>{t('Додати до складу')}</button>
        </form>
      </details>

      {lines.length > 0 && (
        <>
          <h3>{t('Склад')}</h3>
          <ul className="cards">
            {lines.map((l, i) => (
              <li key={i}>
                {l.name}{' '}
                <input type="number" min={0} max={showGrams(5000)} step="any" value={showGrams(l.grams)} style={{ width: 80 }}
                  onChange={(e) =>
                    setLines(lines.map((x, j) => (j === i ? { ...x, grams: storeGrams(Number(e.target.value)) } : x)))
                  } />{' '}
                {gramUnit()} <button onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
          <p>
            {t('Порцій:')}{' '}
            <input type="number" min={1} max={50} value={servings} style={{ width: 60 }}
              onChange={(e) => setServings(Math.max(1, Number(e.target.value)))} />
          </p>
          <p>
            {t('На порцію:')} <strong>{showEnergy(kcal)} {energyUnit()}</strong> · {macrosLine(protein, fat, carbs, fiber)}
          </p>
          <p>
            <input placeholder={t('Назва страви')} value={name} maxLength={100}
              onChange={(e) => setName(e.target.value)} />{' '}
            <button onClick={saveDish}>{t('Зберегти як страву')}</button>
          </p>
        </>
      )}
      <p>
        <small>
          {t('Дані про продукти з Open Food Facts, показуємо лише українські назви. Значення можуть бути неточними. За штрихкодом назва може бути іншою мовою.')}
        </small>
      </p>
    </section>
  )
}
