import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.calendar.router import get_store as get_calendar_store
from app.calories import router as calories_router
from app.calories.day import summarize
from app.calories.food import FoodSearchError, is_ukrainian, parse_products
from app.main import app
from app.profile.router import get_store as get_profile_store


def test_parse_products_filters_and_dedupes():
    products = [
        {"product_name": "Гречка", "lang": "uk", "nutriments": {"energy-kcal_100g": 329, "proteins_100g": 12.6}},
        {"product_name": "гречка", "lang": "uk", "nutriments": {"energy-kcal_100g": 300}},
        {"product_name": "", "lang": "uk", "nutriments": {"energy-kcal_100g": 100}},
        {"product_name": "Без калорій", "lang": "uk", "nutriments": {}},
    ]
    items = parse_products(products)
    assert [i.name for i in items] == ["Гречка"]
    assert items[0].protein_100g == 12.6 and items[0].fat_100g == 0


@pytest.mark.parametrize(
    "name,expected",
    [
        ("Яблуко Персик Пюре", True),
        ("Сік яблуко, манго, персик", True),
        ("Пюре «Gerber» яблуко", True),  # brand in Latin, text mostly Cyrillic
        ("Chicken Breast Fillets", False),
        ("Blanc de Poulet", False),
        ("Гречка в томатном соусе с киноа", False),  # Russian: standalone "с"
        ("Сыр плавленый", False),  # Russian: has "ы"
        ("Яблоко и груша, пюре", False),  # Russian: standalone "и"
        ("Пюре яблуко і груша", True),
        ("Молоко ультрапастеризованное", False),  # Russian ending -ное
        ("Гречка алтайская", False),  # Russian ending -ая
        ("Молоко згущене незбиране", True),
        ("Сир кисломолочний 5%", True),
        ("Молоко коров'яче пастеризоване", True),
        ("Healthy breakfast груша яблуко", False),  # more Latin than Cyrillic
        ("", False),
    ],
)
def test_is_ukrainian(name, expected):
    assert is_ukrainian(name) is expected


def test_only_ukrainian_names_are_returned_and_the_uk_field_wins():
    products = [
        {"product_name": "Chicken Breast", "nutriments": {"energy-kcal_100g": 115}},
        {"product_name": "Chicken Breast", "product_name_uk": "Куряче філе",
         "nutriments": {"energy-kcal_100g": 110}},
        {"product_name": "Куряча грудка", "lang": "uk", "nutriments": {"energy-kcal_100g": 120}},
        {"product_name": "Гречка с мясом", "lang": "uk", "nutriments": {"energy-kcal_100g": 150}},
    ]
    assert [i.name for i in parse_products(products)] == ["Куряче філе", "Куряча грудка"]


def test_russian_and_unmarked_cyrillic_entries_are_skipped():
    products = [
        {"product_name": "Молоко 2.5% пастеризоване", "lang": "ru", "nutriments": {"energy-kcal_100g": 52}},
        {"product_name": "Молоко 3,2%", "nutriments": {"energy-kcal_100g": 60}},  # no language mark
        {"product_name": "Гречка отварная", "lang": "bg", "nutriments": {"energy-kcal_100g": 110}},
        {"product_name": "Молоко", "product_name_uk": "Молоко ультрапастеризованное",
         "nutriments": {"energy-kcal_100g": 60}},  # the uk field holds Russian text
        {"product_name": "Гречка ядриця", "lang": "uk", "nutriments": {"energy-kcal_100g": 330}},
        {"product_name": "Мілка", "product_name_uk": "Молоко згущене", "lang": "ru",
         "nutriments": {"energy-kcal_100g": 320}},
    ]
    assert [i.name for i in parse_products(products)] == ["Гречка ядриця", "Молоко згущене"]


def test_summarize_totals_and_meals():
    dish = lambda name, kcal: {"name": name, "calories": kcal, "protein_g": 10, "fat_g": None, "carbs_g": 20, "fiber_g": 4}
    result = summarize([
        {"slot": 1, "dish": dish("Суп", 200)},
        {"slot": 0, "dish": dish("Каша", 300)},
        {"slot": 0, "dish": dish("Чай", None)},
        {"slot": 2, "dish": None},
    ])
    assert result["total"] == {"kcal": 500.0, "protein_g": 30.0, "fat_g": 0.0, "carbs_g": 60.0, "fiber_g": 12.0}
    assert [m["slot"] for m in result["meals"]] == [0, 1]
    assert result["meals"][0]["dishes"] == ["Каша", "Чай"]


class FakeCalendar:
    def list(self, start, end):
        return [{"slot": 0, "dish": {"name": "Каша", "calories": 300}}]


class FakeProfiles:
    def __init__(self, row):
        self.row = row

    def get(self, user_id):
        return self.row


PROFILE = {
    "sex": "female", "age": 30, "height_cm": 165, "weight_kg": 60,
    "activity": "light", "goal": "maintain", "target_calories": None,
}


@pytest.fixture
def client():
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_calendar_store] = lambda: FakeCalendar()
    app.dependency_overrides[get_profile_store] = lambda: FakeProfiles(PROFILE)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_day_uses_recommended_target_when_none_set(client):
    data = client.get("/api/calories/day?date=2026-11-10").json()
    assert data["target"] == 1815
    assert data["total"]["kcal"] == 300


def test_day_without_profile_has_no_target(client):
    app.dependency_overrides[get_profile_store] = lambda: FakeProfiles(None)
    assert client.get("/api/calories/day?date=2026-11-10").json()["target"] is None


def test_food_search_error_is_503(client, monkeypatch):
    def boom(q):
        raise FoodSearchError("down")

    monkeypatch.setattr(calories_router, "search_food", boom)
    assert client.get("/api/calories/food?q=гречка").status_code == 503
    assert client.get("/api/calories/food?q=a").status_code == 422


def test_range_gives_a_total_for_every_day():
    class Calendar:
        def list(self, start, end):
            dish = {"name": "Борщ", "calories": 250, "protein_g": 5, "fat_g": 4, "carbs_g": 30}
            return [{"date": "2026-11-10", "slot": 1, "dish": dish}]

    class Profiles:
        def get(self, user_id):
            return None

    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_calendar_store] = lambda: Calendar()
    app.dependency_overrides[get_profile_store] = lambda: Profiles()
    try:
        client = TestClient(app)
        data = client.get("/api/calories/range?start=2026-11-09&end=2026-11-11").json()
        assert [d["kcal"] for d in data["days"]] == [0, 250, 0]
        assert client.get("/api/calories/range?start=2026-11-09&end=2027-06-01").status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_html_entities_in_names_are_decoded():
    products = [{"product_name_uk": "Крупа рисова &quot;Басматі&quot;", "nutriments": {"energy-kcal_100g": 350}}]
    assert parse_products(products)[0].name == 'Крупа рисова "Басматі"'


# ---- barcode lookup ----

from app.calories.food import NO_NUTRITION, NOT_FOUND, lookup_barcode, parse_barcode_product  # noqa: E402


def off(product, status=1):
    return {"status": status, "product": product}


def test_a_barcode_product_with_a_ukrainian_name():
    item = parse_barcode_product(off({
        "product_name_uk": "Йогурт натуральний", "product_name": "Natural yogurt", "brands": "Яготинське, Інше",
        "nutriments": {"energy-kcal_100g": 62, "proteins_100g": 4.1, "fat_100g": 2.5, "carbohydrates_100g": 5.7, "fiber_100g": 0},
    }))
    assert item.name == "Йогурт натуральний (Яготинське)"
    assert (item.kcal_100g, item.protein_100g, item.fat_100g, item.carbs_100g) == (62, 4.1, 2.5, 5.7)


def test_a_foreign_name_is_better_than_nothing_for_a_package_in_the_hand():
    item = parse_barcode_product(off({"product_name": "Chocolate Bar", "brands": "Milka", "nutriments": {"energy-kcal_100g": 530}}))
    assert item.name == "Chocolate Bar (Milka)"
    assert parse_barcode_product(off({"product_name_en": "Rice cakes", "nutriments": {"energy-kcal_100g": 380}})).name == "Rice cakes"


def test_the_brand_is_not_repeated_when_the_name_has_it():
    item = parse_barcode_product(off({"product_name": "Milka Alpine Milk", "brands": "Milka", "nutriments": {"energy-kcal_100g": 530}}))
    assert item.name == "Milka Alpine Milk"


def test_kilojoules_only_are_converted_to_kcal():
    item = parse_barcode_product(off({"product_name": "Oats", "nutriments": {"energy_100g": 1569}}))
    assert item.kcal_100g == 375


def test_unknown_products_and_products_without_calories():
    assert parse_barcode_product({"status": 0, "status_verbose": "product not found"}) == NOT_FOUND
    assert parse_barcode_product(off({"product_name": "", "nutriments": {"energy-kcal_100g": 5}})) == NOT_FOUND
    assert parse_barcode_product(off({"product_name": "Mystery", "nutriments": {}})) == NO_NUTRITION


def test_the_barcode_endpoint_answers_for_each_case(client, monkeypatch):
    from app.calories import router as r
    from app.calories.food import FoodItem

    item = FoodItem(name="Йогурт", kcal_100g=62, protein_100g=4, fat_100g=2, carbs_100g=5)
    monkeypatch.setattr(r, "lookup_barcode", lambda code: item)
    assert client.get("/api/calories/barcode/4820000000012").json()["name"] == "Йогурт"
    monkeypatch.setattr(r, "lookup_barcode", lambda code: NOT_FOUND)
    assert client.get("/api/calories/barcode/4820000000012").json() == {"detail": "product_not_found"}
    monkeypatch.setattr(r, "lookup_barcode", lambda code: NO_NUTRITION)
    r2 = client.get("/api/calories/barcode/4820000000012")
    assert r2.status_code == 422 and r2.json() == {"detail": "no_nutrition"}

    def down(code):
        raise FoodSearchError("down")

    monkeypatch.setattr(r, "lookup_barcode", down)
    assert client.get("/api/calories/barcode/4820000000012").status_code == 503


@pytest.mark.parametrize("bad", ["123", "abcdefgh", "48200000000123456", "4820000000012x"])
def test_only_real_barcodes_are_accepted(client, bad):
    assert client.get(f"/api/calories/barcode/{bad}").status_code == 422


def test_lookup_asks_the_database_once_and_remembers_the_answer(monkeypatch):
    from app.calories import food

    food._barcode_cache.clear()
    calls = []

    class Resp:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return off({"product_name": "Oats", "nutriments": {"energy-kcal_100g": 370}})

    monkeypatch.setattr(food.httpx, "get", lambda *a, **k: calls.append(a) or Resp())
    assert lookup_barcode("5000000000017").name == "Oats"
    assert lookup_barcode("5000000000017").name == "Oats"
    assert len(calls) == 1


def test_an_unknown_barcode_that_open_food_facts_answers_404_for(monkeypatch):
    from app.calories import food

    food._barcode_cache.clear()

    class Resp:
        status_code = 404

    monkeypatch.setattr(food.httpx, "get", lambda *a, **k: Resp())
    assert lookup_barcode("5000000000024") == NOT_FOUND


def test_an_outage_is_reported_after_one_retry(monkeypatch):
    from app.calories import food

    food._barcode_cache.clear()
    monkeypatch.setattr(food.time, "sleep", lambda s: None)

    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(food.httpx, "get", boom)
    with pytest.raises(FoodSearchError):
        lookup_barcode("5000000000031")
