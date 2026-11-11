/** Puts every numbered step ("1. … 2. …") of a recipe on its own line. */
export function oneStepPerLine(text: string): string {
  const numbers = [...text.matchAll(/(?:^|\s)(\d{1,2})[.)]\s/g)].map((m) => Number(m[1]))
  if (numbers.length < 2 || numbers[0] !== 1 || numbers[1] !== 2) return text.trim()
  return text.trim().replace(/[ \t]+(?=(?<!\d)\d{1,2}[.)]\s)/g, '\n')
}
