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
        {"product_name": "Гречка", "nutriments": {"energy-kcal_100g": 329, "proteins_100g": 12.6}},
        {"product_name": "гречка", "nutriments": {"energy-kcal_100g": 300}},
        {"product_name": "", "nutriments": {"energy-kcal_100g": 100}},
        {"product_name": "Без калорій", "nutriments": {}},
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
        {"product_name": "Куряча грудка", "nutriments": {"energy-kcal_100g": 120}},
        {"product_name": "Гречка с мясом", "nutriments": {"energy-kcal_100g": 150}},
    ]
    assert [i.name for i in parse_products(products)] == ["Куряче філе", "Куряча грудка"]


def test_summarize_totals_and_meals():
    dish = lambda name, kcal: {"name": name, "calories": kcal, "protein_g": 10, "fat_g": None, "carbs_g": 20}
    result = summarize([
        {"slot": 1, "dish": dish("Суп", 200)},
        {"slot": 0, "dish": dish("Каша", 300)},
        {"slot": 0, "dish": dish("Чай", None)},
        {"slot": 2, "dish": None},
    ])
    assert result["total"] == {"kcal": 500.0, "protein_g": 30.0, "fat_g": 0.0, "carbs_g": 60.0}
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
