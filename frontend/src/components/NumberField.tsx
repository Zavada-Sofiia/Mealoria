import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { t } from '../i18n'
import { num } from '../units'

/** " 300 ", "1 200" and "12,5" are numbers; "" is no value (null); anything else is NaN. */
export function parseNumber(text: string): number | null {
  const plain = text.replace(/[\s  ]/g, '').replace(',', '.')
  if (!plain) return null
  return /^(\d+\.?\d*|\.\d+)$/.test(plain) ? Number(plain) : NaN
}

/**
 * Ties a field's own check to its form: the form is not sent, the first wrong field is scrolled to and focused,
 * and the message appears in red under the field instead of a browser bubble. `onBlur` also shows it when the
 * person leaves the field; a required field waits for the form to be sent.
 */
export function useFieldCheck(problem: string, { onBlur = true } = {}) {
  const ref = useRef<HTMLInputElement>(null)
  const [shown, setShown] = useState(false)
  // every render: the field may appear later than the hook (a form that opens on a button)
  useEffect(() => {
    ref.current?.setCustomValidity(problem)
  })
  const props = {
    ref,
    'aria-invalid': shown && !!problem,
    onInvalid: (e: FormEvent<HTMLInputElement>) => {
      e.preventDefault()
      setShown(true)
      const field = e.currentTarget
      if (field.form?.querySelector('input:invalid, textarea:invalid, select:invalid') === field) {
        field.scrollIntoView({ block: 'center', behavior: 'smooth' })
        field.focus({ preventScroll: true })
      }
    },
    onBlur: () => onBlur && setShown(true),
  }
  const message = shown && problem ? <small className="field-error" role="alert">{problem}</small> : null
  return { props, message }
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number | null
  onChange: (value: number | null) => void
  min: number
  max: number
  integer?: boolean
}

const same = (a: number | null, b: number | null) => a === b || (a !== null && b !== null && Math.abs(a - b) < 1e-9)

/**
 * A number field that forgives how people type: spaces around or inside the number and a decimal comma.
 * The person's text is kept while they type; a wrong or out-of-range number stops the form with a message.
 */
export default function NumberField({ value, onChange, min, max, integer = false, className, onBlur, ...rest }: Props) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const parsed = parseNumber(text)
  const problem =
    parsed === null
      ? ''
      : Number.isNaN(parsed) || (integer && !Number.isInteger(parsed))
        ? integer
          ? t('Введіть ціле число')
          : t('Введіть число')
        : parsed < min || parsed > max
          ? t('Від {min} до {max}', { min: num(min), max: num(max) })
          : ''
  const check = useFieldCheck(problem)
  const sync = () => {
    if (!same(parseNumber(text), value)) setText(value === null ? '' : String(value))
  }
  // a value set from outside (another dish opened, an AI estimate) replaces the text, but never while typing
  useEffect(() => {
    if (document.activeElement !== check.props.ref.current) sync()
  }, [value])

  return (
    <>
      <input
        {...rest}
        {...check.props}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        className={className ? `num ${className}` : 'num'}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const v = parseNumber(e.target.value)
          onChange(v === null || Number.isNaN(v) ? null : v)
        }}
        onBlur={(e) => {
          check.props.onBlur()
          onBlur?.(e)
          if (!problem) sync()
        }}
      />
      {check.message}
    </>
  )
}
