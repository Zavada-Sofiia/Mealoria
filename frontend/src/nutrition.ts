// Daily targets for protein, fat, carbs, fibre and water, worked out from the profile and the calorie target.
// General guidance for healthy adults, not medical advice.

export type Targets = {
  protein_g: number
  fat_g: number
  carbs_g: number
  fiber_g: number
  water_ml: number
}

type Input = { weight_kg: number; goal: string; activity: string }

// protein, grams per kg of body weight: more for an active person, more again when losing or gaining weight
const PROTEIN_PER_KG: Record<string, number> = { sedentary: 1.0, light: 1.2, moderate: 1.4, active: 1.6 }
const GOAL_PROTEIN_BONUS: Record<string, number> = { lose: 0.4, maintain: 0, gain: 0.2 }
// water, millilitres per kg of body weight
const WATER_PER_KG: Record<string, number> = { sedentary: 30, light: 32, moderate: 35, active: 40 }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function dailyTargets(p: Input, kcal: number): Targets {
  const perKg = (PROTEIN_PER_KG[p.activity] ?? 1.2) + (GOAL_PROTEIN_BONUS[p.goal] ?? 0)
  // never below 0.8 g/kg and never more than 30% of the calories
  const protein = clamp(perKg * p.weight_kg, 0.8 * p.weight_kg, (0.3 * kcal) / 4)
  const fat = (0.3 * kcal) / 9 // 30% of the calories
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4) // what is left
  const fiber = clamp((14 * kcal) / 1000, 20, 45) // 14 g per 1000 kcal
  const water = clamp(p.weight_kg * (WATER_PER_KG[p.activity] ?? 32), 1500, 4500)
  return {
    protein_g: Math.round(protein),
    fat_g: Math.round(fat),
    carbs_g: Math.round(carbs),
    fiber_g: Math.round(fiber),
    water_ml: Math.round(water / 50) * 50,
  }
}

type ProfileResponse = {
  profile: { weight_kg: number; goal: string; activity: string; target_calories: number | null } | null
  recommended_calories: number | null
}

/** Targets from what /api/profile returns, or null while the profile is not filled in. */
export function targetsFromProfile(r: ProfileResponse | null): Targets | null {
  const p = r?.profile
  const kcal = p?.target_calories ?? r?.recommended_calories
  if (!p || !kcal || !p.weight_kg) return null
  return dailyTargets(p, kcal)
}
