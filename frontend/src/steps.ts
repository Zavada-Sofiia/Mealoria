/** Puts every step of a recipe on its own line: numbered steps ("1. … 2. …"), otherwise every sentence. */
export function oneStepPerLine(text: string): string {
  const numbers = [...text.matchAll(/(?:^|\s)(\d{1,2})[.)]\s/g)].map((m) => Number(m[1]))
  if (numbers.length < 2 || numbers[0] !== 1 || numbers[1] !== 2) {
    // a sentence ends with a full stop and the next one starts with a capital; "1 ч. л." does not split
    return text.trim().replace(/(?<=[.!?])[ \t]+(?=[А-ЯІЇЄҐA-Z])/g, '\n')
  }
  return text.trim().replace(/[ \t]+(?=(?<!\d)\d{1,2}[.)]\s)/g, '\n')
}
