import { MAX_SERVINGS } from '../servings'

export default function ServingsPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="servings" role="group" aria-label="Кількість людей">
      <span>Кількість людей</span>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Менше">
        −
      </button>
      <strong>{value}</strong>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= MAX_SERVINGS} aria-label="Більше">
        +
      </button>
    </div>
  )
}
