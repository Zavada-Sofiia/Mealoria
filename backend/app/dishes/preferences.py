DIET_ALLOWS = {
    "any": {"any", "pescatarian", "vegetarian", "vegan"},
    "pescatarian": {"pescatarian", "vegetarian", "vegan"},
    "vegetarian": {"vegetarian", "vegan"},
    "vegan": {"vegan"},
}
BUDGET_ALLOWS = {"any": {"low", "medium"}, "medium": {"low", "medium"}, "low": {"low"}}


def matches(recipe: dict, prefs: dict) -> bool:
    if recipe["diet"] not in DIET_ALLOWS[prefs["diet"]]:
        return False
    if set(recipe["allergens"]) & set(prefs["allergens"]):
        return False
    if prefs["cook_time"] != "any" and recipe["cook_minutes"] > int(prefs["cook_time"]):
        return False
    return recipe["budget"] in BUDGET_ALLOWS[prefs["budget"]]


def apply_preferences(recipes: list[dict], prefs: dict) -> list[dict]:
    """Drop recipes that conflict with the profile; put favourite cuisines first."""
    fits = [r for r in recipes if matches(r, prefs)]
    favourite = set(prefs["cuisines"])
    return sorted(fits, key=lambda r: r.get("cuisine") not in favourite)
