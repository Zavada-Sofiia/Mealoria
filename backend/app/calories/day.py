def summarize(entries: list[dict]) -> dict:
    """Total calories and macros for planned dishes, plus a breakdown per meal."""
    total = {"kcal": 0.0, "protein_g": 0.0, "fat_g": 0.0, "carbs_g": 0.0}
    meals: dict[int, dict] = {}
    for e in entries:
        dish = e.get("dish")
        if not dish:
            continue
        meal = meals.setdefault(e["slot"], {"slot": e["slot"], "kcal": 0.0, "dishes": []})
        meal["dishes"].append(dish["name"])
        for field, key in (("calories", "kcal"), ("protein_g", "protein_g"),
                           ("fat_g", "fat_g"), ("carbs_g", "carbs_g")):
            value = dish.get(field) or 0
            total[key] += value
            if key == "kcal":
                meal["kcal"] += value
    return {
        "total": {k: round(v, 1) for k, v in total.items()},
        "meals": [meals[s] for s in sorted(meals)],
    }
