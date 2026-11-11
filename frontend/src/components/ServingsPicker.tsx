import { MAX_SERVINGS } from '../servings'
import { t } from '../i18n'

export default function ServingsPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="servings" role="group" aria-label={t('Кількість людей')}>
      <span>{t('Кількість людей')}</span>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={t('Менше')}>
        −
      </button>
      <strong>{value}</strong>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= MAX_SERVINGS} aria-label={t('Більше')}>
        +
      </button>
    </div>
  )
}
