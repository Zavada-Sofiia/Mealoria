import { getDateFormat } from './units'

export const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

/** 2026-11-09 -> 09.11.2026 (or 11/09/2026 when the US format is chosen) */
export const fmtDate = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-')
  return getDateFormat() === 'mdy' ? `${m}/${d}/${y}` : `${d}.${m}.${y}`
}

/** 2026-11-09 -> 09.11 (or 11/09) */
export const fmtShortDate = (isoDate: string) => {
  const [, m, d] = isoDate.split('-')
  return getDateFormat() === 'mdy' ? `${m}/${d}` : `${d}.${m}`
}
