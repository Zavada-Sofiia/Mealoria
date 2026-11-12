"""Filling the empty meals of a week from the user's own dishes, close to the daily calorie target."""

import datetime as dt
import random

MEAL_NAMES = {
    1: [None],
    2: ["сніданок", "вечеря"],
    3: ["сніданок", "обід", "вечеря"],
    4: ["сніданок", "обід", "перекус", "вечеря"],
    5: ["сніданок", "перекус", "обід", "перекус", "вечеря"],
}
SHARES = {
    1: [1.0],
    2: [0.4, 0.6],
    3: [0.25, 0.4, 0.35],
    4: [0.25, 0.35, 0.1, 0.3],
    5: [0.25, 0.1, 0.35, 0.1, 0.2],
}
MEAL_TYPES = {"сніданок", "обід", "вечеря", "перекус"}
# a dish without a meal type still suits a slot when its kind fits it
KIND_FITS = {
    "сніданок": {"випічка", "напій"},
    "обід": {"суп", "основна страва", "салат"},
    "вечеря": {"основна страва", "салат", "гарнір"},
    "перекус": {"десерт", "випічка", "закуска", "напій", "салат"},
}
DEFAULT_TARGET = 2000


def slot_category(meals: int, slot: int) -> str | None:
    names = MEAL_NAMES.get(meals)
    return names[slot] if names and slot < len(names) else None


def slot_share(meals: int, slot: int) -> float:
    shares = SHARES.get(meals)
    return shares[slot] if shares and slot < len(shares) else 1.0 / max(meals, 1)


def fit_rank(categories: list[str], wanted: str | None) -> int | None:
    """0: made for this meal, 1: its kind fits it, 2: no type given, None: belongs to another meal."""
    cats = set(categories or [])
    if wanted is None or wanted in cats:
        return 0
    if cats & MEAL_TYPES:
        return None
    if not cats:
        return 2
    return 1 if cats & KIND_FITS.get(wanted, set()) else None


def _score(dish: dict, rank: int, slot_target: float, used: dict[str, int], yesterday: set[str], today: set[str], rng) -> float:
    kcal = dish.get("calories")
    gap = abs(kcal - slot_target) / max(slot_target, 1) if kcal else 0.35
    score = gap * 2.0 + (0.0, 0.8, 1.0)[rank]
    if dish.get("favorite"):
        score -= 0.4
    dish_id = dish["id"]
    score += 0.5 * used.get(dish_id, 0)
    if dish_id in yesterday:
        score += 1.5
    if dish_id in today:
        score += 3.0
    return score + rng.random() * 0.5


def plan_week(
    dishes: list[dict],
    existing: list[dict],
    dates: list[dt.date],
    meals: int,
    daily_target: int | None,
    rng: random.Random | None = None,
) -> tuple[list[dict], int]:
    """New calendar rows for the empty meals on `dates`, and how many meals had no suitable dish."""
    rng = rng or random.Random()
    target = daily_target or DEFAULT_TARGET
    by_id = {d["id"]: d for d in dishes}
    filled: dict[tuple[str, int], bool] = {}
    day_kcal: dict[str, float] = {}
    day_dishes: dict[str, set[str]] = {}
    used: dict[str, int] = {}
    for e in existing:
        dish = e.get("dish")
        if not dish:
            continue
        key = str(e["date"])
        filled[(key, e["slot"])] = True
        day_kcal[key] = day_kcal.get(key, 0) + (dish.get("calories") or 0)
        day_dishes.setdefault(key, set()).add(dish["id"])
        used[dish["id"]] = used.get(dish["id"], 0) + 1

    rows: list[dict] = []
    unfilled = 0
    for date in dates:
        key = date.isoformat()
        yesterday = day_dishes.get((date - dt.timedelta(days=1)).isoformat(), set())
        today = day_dishes.setdefault(key, set())
        for slot in range(meals):
            if filled.get((key, slot)):
                continue
            wanted = slot_category(meals, slot)
            left_shares = sum(slot_share(meals, s) for s in range(slot, meals) if not filled.get((key, s))) or 1.0
            slot_target = max(target - day_kcal.get(key, 0), target * 0.1) * slot_share(meals, slot) / left_shares
            options = [(d, r) for d in dishes if (r := fit_rank(d.get("categories") or [], wanted)) is not None]
            if not options:
                unfilled += 1
                continue
            dish, _ = min(options, key=lambda o: _score(o[0], o[1], slot_target, used, yesterday, today, rng))
            rows.append({"date": key, "slot": slot, "dish_id": dish["id"]})
            today.add(dish["id"])
            used[dish["id"]] = used.get(dish["id"], 0) + 1
            day_kcal[key] = day_kcal.get(key, 0) + (by_id[dish["id"]].get("calories") or 0)
    return rows, unfilled


def missing_for_catalog(dishes: list[dict], meals: int, want_each: int = 4) -> dict[str, int]:
    """For each meal type used by the slots: how many more dishes would give enough variety."""
    need: dict[str, int] = {}
    for slot in range(meals):
        wanted = slot_category(meals, slot)
        if wanted is None or wanted in need:
            continue
        have = sum(1 for d in dishes if fit_rank(d.get("categories") or [], wanted) == 0)
        if have < want_each:
            need[wanted] = want_each - have
    return need
