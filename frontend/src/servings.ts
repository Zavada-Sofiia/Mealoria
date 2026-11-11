import { useState } from 'react'

export const MAX_SERVINGS = 12
const KEY = 'servings'

function load(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isInteger(n) && n >= 1 && n <= MAX_SERVINGS ? n : 1
  } catch {
    return 1
  }
}

/** How many people the user cooks for; kept in this browser only. */
export function useServings(): [number, (n: number) => void] {
  const [servings, setServings] = useState(load)
  return [
    servings,
    (n) => {
      const next = Math.min(MAX_SERVINGS, Math.max(1, n))
      setServings(next)
      try {
        localStorage.setItem(KEY, String(next))
      } catch {
        // the choice just lasts until the page is closed
      }
    },
  ]
}

function format(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

function tidyUnit(amount: string): string {
  return amount
    .replace(/(\d+(?:,\d+)?)\s*г(?![а-яіїєґ])/giu, (m, n) => {
      const v = Number(n.replace(',', '.'))
      return v >= 1000 ? `${format(v / 1000)} кг` : m
    })
    .replace(/(\d+(?:,\d+)?)\s*мл(?![а-яіїєґ])/giu, (m, n) => {
      const v = Number(n.replace(',', '.'))
      return v >= 1000 ? `${format(v / 1000)} л` : m
    })
}

/** "80 г" for 3 people becomes "240 г"; text without numbers ("за смаком") stays as it is. */
export function scaleAmount(amount: string, factor: number): string {
  if (factor === 1 || !amount) return amount
  const scaled = amount.replace(/(\d+)\s*\/\s*(\d+)|(\d+(?:[.,]\d+)?)/g, (_m, a, b, num) => {
    const value = a ? Number(a) / Number(b) : Number(num.replace(',', '.'))
    return format(value * factor)
  })
  return tidyUnit(scaled)
}
