import { useState } from 'react'
import { t } from '../i18n'

const MEALS = ['сніданок', 'обід', 'вечеря', 'перекус']
const KINDS = ['основна страва', 'суп', 'салат', 'гарнір', 'закуска', 'десерт', 'випічка', 'напій']

export type DishFilter = { query: string; meal: string; kind: string; onlyFav: boolean }
export const NO_FILTER: DishFilter = { query: '', meal: '', kind: '', onlyFav: false }

export function filterDishes<D extends { name: string; favorite?: boolean; categories?: string[] }>(
  dishes: D[],
  f: DishFilter,
): D[] {
  const needle = f.query.trim().toLowerCase()
  return dishes.filter(
    (d) =>
      (!f.onlyFav || d.favorite) &&
      (!f.meal || (d.categories ?? []).includes(f.meal)) &&
      (!f.kind || (d.categories ?? []).includes(f.kind)) &&
      d.name.toLowerCase().includes(needle),
  )
}

/** Search plus the «Фільтри» button, the same as on «Мої страви». */
export default function DishFilters({ value, onChange }: { value: DishFilter; onChange: (f: DishFilter) => void }) {
  const [open, setOpen] = useState(false)
  const active = (value.meal ? 1 : 0) + (value.kind ? 1 : 0) + (value.onlyFav ? 1 : 0)
  const set = (patch: Partial<DishFilter>) => onChange({ ...value, ...patch })
  return (
    <div className="dish-tools">
      <input
        type="search"
        placeholder={t('Пошук серед моїх страв')}
        value={value.query}
        onChange={(e) => set({ query: e.target.value })}
      />
      <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {active ? t('Фільтри ({n})', { n: active }) : t('Фільтри')} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="filters-panel">
          <div className="meal-filter">
            <small className="muted">{t('Прийом їжі')}:</small>
            {['', ...MEALS].map((c) => (
              <button key={c || 'all'} type="button" className={`chip-btn${value.meal === c ? ' on' : ''}`} onClick={() => set({ meal: c })}>
                {c ? t(c) : t('Усі')}
              </button>
            ))}
          </div>
          <div className="meal-filter">
            <small className="muted">{t('Тип страви')}:</small>
            {['', ...KINDS].map((c) => (
              <button key={c || 'all'} type="button" className={`chip-btn${value.kind === c ? ' on' : ''}`} onClick={() => set({ kind: c })}>
                {c ? t(c) : t('Усі')}
              </button>
            ))}
          </div>
          <label className="inline">
            <input type="checkbox" checked={value.onlyFav} onChange={(e) => set({ onlyFav: e.target.checked })} /> {t('Лише улюблені')}
          </label>
        </div>
      )}
    </div>
  )
}
