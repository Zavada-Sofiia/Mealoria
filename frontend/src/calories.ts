// Mirrors backend/app/profile/calc.py (Mifflin-St Jeor); the backend stays the source of truth
// for stored data, this copy only powers the live preview on the profile page.
export const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
}
export const GOAL_FACTOR: Record<string, number> = { lose: 0.85, maintain: 1, gain: 1.1 }

// Python's round() sends exact halves to the even neighbour; Math.round always goes up.
function roundHalfEven(x: number): number {
  const floor = Math.floor(x)
  const diff = x - floor
  if (diff < 0.5) return floor
  if (diff > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

export type Estimate = {
  bmr: number
  activityFactor: number
  tdee: number
  goalFactor: number
  recommended: number
}

type Input = {
  sex: string
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  activity: string
  goal: string
}

export function estimateCalories(p: Input): Estimate | null {
  if (p.age === null || p.height_cm === null || p.weight_kg === null) return null
  if (p.age < 10 || p.age > 100 || p.height_cm < 100 || p.height_cm > 250) return null
  if (p.weight_kg < 30 || p.weight_kg > 300) return null
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + (p.sex === 'male' ? 5 : -161)
  const activityFactor = ACTIVITY_FACTOR[p.activity] ?? 1.2
  const goalFactor = GOAL_FACTOR[p.goal] ?? 1
  const tdee = bmr * activityFactor
  return {
    bmr: Math.round(bmr),
    activityFactor,
    tdee: Math.round(tdee),
    goalFactor,
    recommended: roundHalfEven(tdee * goalFactor),
  }
}
