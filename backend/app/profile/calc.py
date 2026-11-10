ACTIVITY_FACTOR = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
}
GOAL_FACTOR = {"lose": 0.85, "maintain": 1.0, "gain": 1.10}


def bmr(sex: str, age: int, height_cm: int, weight_kg: float) -> float:
    """Mifflin-St Jeor basal metabolic rate, kcal/day."""
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + (5 if sex == "male" else -161)


def recommended_calories(
    sex: str, age: int, height_cm: int, weight_kg: float, activity: str, goal: str
) -> int:
    tdee = bmr(sex, age, height_cm, weight_kg) * ACTIVITY_FACTOR[activity]
    return round(tdee * GOAL_FACTOR[goal])
