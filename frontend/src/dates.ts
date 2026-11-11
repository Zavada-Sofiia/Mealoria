export const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
/** 2026-11-09 -> 09.11.2026 */
export const fmtDate = (isoDate: string) => isoDate.split('-').reverse().join('.')
