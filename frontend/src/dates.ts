export const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
