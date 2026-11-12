import datetime as dt
import random

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.calendar.autoplan import fit_rank, missing_for_catalog, plan_week
from app.calendar.router import get_store as get_calendar_store
from app.dishes.recipes_router import get_recipe_store
from app.dishes.router import get_store as get_dish_store
from app.main import app
from app.profile.router import get_store as get_profile_store

MONDAY = dt.date(2026, 11, 9)
WEEK = [MONDAY + dt.timedelta(days=i) for i in range(7)]


def dish(i, kcal, categories, favorite=False):
    return {"id": f"d{i}", "name": f"Страва {i}", "calories": kcal, "categories": categories, "favorite": favorite}


MENU = [
    dish(1, 350, ["сніданок"]), dish(2, 400, ["сніданок"]), dish(3, 300, ["сніданок"]),
    dish(4, 700, ["обід"]), dish(5, 650, ["обід"]), dish(6, 600, ["обід"]),
    dish(7, 600, ["вечеря"]), dish(8, 550, ["вечеря"]), dish(9, 500, ["вечеря"]),
]


def run(dishes=MENU, existing=(), dates=WEEK, meals=3, target=1800, seed=1):
    return plan_week(list(dishes), list(existing), dates, meals, target, random.Random(seed))


def test_each_meal_gets_a_dish_made_for_it():
    rows, unfilled = run()
    assert unfilled == 0 and len(rows) == 21
    kinds = {0: {"d1", "d2", "d3"}, 1: {"d4", "d5", "d6"}, 2: {"d7", "d8", "d9"}}
    assert all(r["dish_id"] in kinds[r["slot"]] for r in rows)


def test_the_days_stay_close_to_the_calorie_target():
    rows, _ = run(target=1800)
    by_id = {d["id"]: d["calories"] for d in MENU}
    for date in WEEK:
        total = sum(by_id[r["dish_id"]] for r in rows if r["date"] == date.isoformat())
        assert 1350 <= total <= 2250, (date, total)


def test_a_bigger_target_picks_bigger_dishes():
    small = {d["id"]: d["calories"] for d in MENU}
    low, _ = run(target=1300)
    high, _ = run(target=2600)
    avg = lambda rows: sum(small[r["dish_id"]] for r in rows) / len(rows)
    assert avg(high) > avg(low)


def test_the_same_dish_is_not_served_on_two_days_in_a_row():
    rows, _ = run()
    for slot in range(3):
        ids = [next(r["dish_id"] for r in rows if r["date"] == d.isoformat() and r["slot"] == slot) for d in WEEK]
        assert all(a != b for a, b in zip(ids, ids[1:])), ids


def test_variety_across_the_week_and_favorites_come_first():
    rows, _ = run()
    assert len({r["dish_id"] for r in rows if r["slot"] == 0}) == 3  # all three breakfasts are used
    menu = [dish(1, 350, ["сніданок"]), dish(2, 350, ["сніданок"], favorite=True)]
    picked, _ = plan_week(menu, [], [MONDAY], 3, 1800, random.Random(3))
    assert picked[0]["dish_id"] == "d2"


def test_meals_that_already_have_a_dish_are_left_alone_and_count_towards_the_day():
    existing = [{"date": "2026-11-09", "slot": 1, "dish": {"id": "d4", "calories": 700}}]
    rows, _ = run(existing=existing, dates=[MONDAY])
    assert {r["slot"] for r in rows} == {0, 2}
    assert len(rows) == 2


def test_nothing_is_added_when_everything_is_filled():
    existing = [{"date": "2026-11-09", "slot": s, "dish": {"id": "d1", "calories": 300}} for s in range(3)]
    rows, unfilled = run(existing=existing, dates=[MONDAY])
    assert rows == [] and unfilled == 0


def test_meals_without_a_suitable_dish_are_counted_not_filled_with_the_wrong_kind():
    only_breakfast = [dish(1, 300, ["сніданок"]), dish(2, 320, ["сніданок"])]
    rows, unfilled = run(dishes=only_breakfast, dates=[MONDAY])
    assert [r["slot"] for r in rows] == [0] and unfilled == 2


def test_fit_rank():
    assert fit_rank(["обід"], "обід") == 0
    assert fit_rank(["обід"], "вечеря") is None
    assert fit_rank(["суп"], "обід") == 1
    assert fit_rank(["обід", "салат"], "вечеря") is None  # made for lunch, even if a salad fits dinner
    assert fit_rank(["десерт"], "обід") is None
    assert fit_rank([], "вечеря") == 2
    assert fit_rank(["вечеря"], None) == 0  # one meal a day: any dish


def test_other_meal_counts_use_the_right_slots():
    rows, _ = run(meals=4, dates=[MONDAY], dishes=MENU + [dish(10, 150, ["перекус"])])
    assert [r["slot"] for r in rows] == [0, 1, 2, 3]
    assert next(r for r in rows if r["slot"] == 2)["dish_id"] == "d10"
    one, _ = run(meals=1, dates=[MONDAY])
    assert len(one) == 1


def test_how_many_dishes_are_missing_for_variety():
    assert missing_for_catalog(MENU, 3) == {"сніданок": 1, "обід": 1, "вечеря": 1}
    assert missing_for_catalog([], 2) == {"сніданок": 4, "вечеря": 4}
    assert missing_for_catalog(MENU, 1) == {}


# ---- the endpoint ----


class FakeCalendar:
    def __init__(self, existing=(), fail_after=None):
        self.rows, self.existing, self.fail_after = [], list(existing), fail_after

    def list(self, start, end):
        return list(self.existing) + [
            {"id": str(i), "date": r["date"], "slot": r["slot"], "dish": {"id": r["dish_id"], "calories": 300}}
            for i, r in enumerate(self.rows)
        ]

    def create_many(self, user_id, rows):
        if self.fail_after is not None and len(self.rows) + len(rows) > self.fail_after:
            raise httpx.HTTPStatusError(
                "limit", request=httpx.Request("POST", "http://x"),
                response=httpx.Response(400, json={"message": "plan_limit:plan_days"}),
            )
        self.rows += rows


class FakeDishes:
    def __init__(self, dishes, limit=100):
        self.dishes, self.limit = list(dishes), limit

    def list(self):
        return list(self.dishes)

    def create(self, user_id, data):
        if len(self.dishes) >= self.limit:
            raise httpx.HTTPStatusError(
                "limit", request=httpx.Request("POST", "http://x"),
                response=httpx.Response(400, json={"message": "plan_limit:dishes"}),
            )
        created = {"id": f"new{len(self.dishes)}", "favorite": False, **data}
        self.dishes.append(created)
        return created


class FakeProfiles:
    row = {
        "sex": "female", "age": 30, "height_cm": 165, "weight_kg": 60, "activity": "light", "goal": "maintain",
        "target_calories": None, "meals_per_day": 3, "diet": "any", "allergens": [], "cook_time": "any",
        "budget": "any", "cuisines": [],
    }

    def get(self, user_id):
        return self.row


class FakeRecipes:
    def __init__(self):
        self.items = [
            {"id": f"r{i}", "name": f"Рецепт {c} {i}", "category": c, "recipe": "…", "ingredients": [], "calories": k,
             "protein_g": 1, "fat_g": 1, "carbs_g": 1, "fiber_g": None, "photo_url": None, "diet": "any",
             "allergens": [], "cuisine": None, "cook_minutes": 20, "budget": "low"}
            for c, k in (("сніданок", 350), ("обід", 650), ("вечеря", 550)) for i in range(6)
        ]

    def list(self, query=""):
        return list(self.items)


@pytest.fixture
def setup():
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    cal, dishes = FakeCalendar(), FakeDishes([])
    app.dependency_overrides[get_calendar_store] = lambda: cal
    app.dependency_overrides[get_dish_store] = lambda: dishes
    app.dependency_overrides[get_profile_store] = lambda: FakeProfiles()
    app.dependency_overrides[get_recipe_store] = lambda: FakeRecipes()
    yield TestClient(app), cal, dishes
    app.dependency_overrides.clear()


def call(client, **params):
    return client.post("/api/calendar/auto-plan", params={"start": "2026-11-09", **params})


def test_a_user_without_dishes_gets_a_week_from_the_catalog(setup):
    client, cal, dishes = setup
    data = call(client).json()
    assert data["added"] == 21 and data["unfilled"] == 0 and data["limited"] is False
    assert data["saved_from_catalog"] == 12  # four for each of breakfast, lunch, dinner
    assert len(dishes.dishes) == 12 and len(cal.rows) == 21
    assert all(d["categories"] and d["categories"][0] in ("сніданок", "обід", "вечеря") for d in dishes.dishes)


def test_the_catalog_can_be_switched_off(setup):
    client, cal, dishes = setup
    data = call(client, use_catalog=False).json()
    assert data["added"] == 0 and data["unfilled"] == 21 and dishes.dishes == []


def test_the_dish_limit_stops_the_top_up_but_the_plan_still_works(setup):
    client, cal, dishes = setup
    dishes.limit = 5
    data = call(client).json()
    assert data["saved_from_catalog"] == 5 and len(dishes.dishes) == 5
    assert data["added"] > 0 and data["added"] + data["unfilled"] == 21


def test_days_before_since_are_not_filled(setup):
    client, cal, _ = setup
    data = call(client, since="2026-11-12").json()
    assert {r["date"] for r in cal.rows} == {"2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"}
    assert data["added"] == 12


def test_days_beyond_the_plan_are_skipped_and_reported(setup):
    client, cal, _ = setup
    cal.fail_after = 9  # the plan allows only the first three days
    data = call(client).json()
    assert data["limited"] is True and data["added"] == 9 and len(cal.rows) == 9


def test_without_a_profile_three_meals_and_a_default_target_are_used(setup):
    client, cal, _ = setup
    app.dependency_overrides[get_profile_store] = lambda: type("P", (), {"get": lambda self, uid: None})()
    assert call(client).json()["added"] == 21
