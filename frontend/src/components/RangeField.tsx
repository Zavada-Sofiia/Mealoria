import { useId } from 'react'
import NumberField from './NumberField'

type Props = {
  label: string
  unit: string
  min: number
  max: number
  value: number | null
  onChange: (value: number | null) => void
  step?: number
  decimals?: boolean
  placeholder?: string
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** A number field that can be emptied (no forced 0) plus a slider for quick adjustment. */
export default function RangeField({
  label,
  unit,
  min,
  max,
  value,
  onChange,
  step = 1,
  decimals = false,
  placeholder,
}: Props) {
  const id = useId()
  const sliderValue = value ?? min
  const pct = ((clamp(sliderValue, min, max) - min) / (max - min)) * 100

  return (
    <div className="range-field">
      <div className="range-head">
        <label htmlFor={id}>{label}</label>
        <div className="range-value">
          <NumberField
            id={id}
            integer={!decimals}
            min={min}
            max={max}
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            onBlur={() => value !== null && onChange(clamp(value, min, max))}
          />
          <span>{unit}</span>
        </div>
      </div>
      <input
        type="range"
        className={value === null ? 'slider empty' : 'slider'}
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={clamp(sliderValue, min, max)}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="range-scale">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
