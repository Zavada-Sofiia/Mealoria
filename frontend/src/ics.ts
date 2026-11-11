import { mealName } from './meals'

export type ExportEntry = { date: string; slot: number; dish: { name: string; calories: number | null } | null }

const HOURS: Record<number, number[]> = {
  1: [13],
  2: [8, 19],
  3: [8, 13, 19],
  4: [8, 13, 16, 19],
  5: [8, 11, 13, 16, 19],
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')
const stamp = (date: string, hour: number) => `${date.replaceAll('-', '')}T${String(hour).padStart(2, '0')}0000`

/** An .ics file the user can open in Google/Apple Calendar: one hour-long event per planned dish. */
export function weekToIcs(entries: ExportEntry[], meals: number): string {
  const hours = HOURS[meals] ?? [8, 13, 19]
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const events = entries
    .filter((e) => e.dish)
    .map((e, i) => {
      const hour = hours[e.slot] ?? 12
      const kcal = e.dish!.calories != null ? ` (${e.dish!.calories} ккал)` : ''
      return [
        'BEGIN:VEVENT',
        `UID:mealoria-${e.date}-${e.slot}-${i}@mealoria`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(e.date, hour)}`,
        `DTEND:${stamp(e.date, hour + 1)}`,
        `SUMMARY:${esc(`${mealName(meals, e.slot)}: ${e.dish!.name}${kcal}`)}`,
        'END:VEVENT',
      ].join('\r\n')
    })
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mealoria//uk', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n')
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
