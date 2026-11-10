from app.dishes.preferences import apply_preferences, matches

PREFS = {"diet": "any", "allergens": [], "cuisines": [], "cook_time": "any", "budget": "any"}


def recipe(name, **kw):
    base = {"name": name, "diet": "any", "allergens": [], "cuisine": None,
            "cook_minutes": 30, "budget": "low"}
    return {**base, **kw}


def test_diet_levels():
    meat, fish = recipe("м'ясо"), recipe("риба", diet="pescatarian")
    veg, vegan = recipe("овочі", diet="vegetarian"), recipe("боби", diet="vegan")
    names = lambda diet: [r["name"] for r in [meat, fish, veg, vegan]
                          if matches(r, {**PREFS, "diet": diet})]
    assert names("any") == ["м'ясо", "риба", "овочі", "боби"]
    assert names("pescatarian") == ["риба", "овочі", "боби"]
    assert names("vegetarian") == ["овочі", "боби"]
    assert names("vegan") == ["боби"]


def test_allergens_exclude_any_overlap():
    r = recipe("сирники", allergens=["gluten", "lactose"])
    assert not matches(r, {**PREFS, "allergens": ["lactose"]})
    assert matches(r, {**PREFS, "allergens": ["nuts"]})


def test_cook_time_and_budget():
    slow = recipe("борщ", cook_minutes=90, budget="medium")
    assert not matches(slow, {**PREFS, "cook_time": "60"})
    assert matches(slow, {**PREFS, "cook_time": "any"})
    assert not matches(slow, {**PREFS, "budget": "low"})
    assert matches(slow, {**PREFS, "budget": "medium"})


def test_favourite_cuisines_come_first_without_dropping_others():
    items = [recipe("a", cuisine="asian"), recipe("b", cuisine="italian"), recipe("c")]
    result = apply_preferences(items, {**PREFS, "cuisines": ["italian"]})
    assert [r["name"] for r in result] == ["b", "a", "c"]
