from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.dishes.recipes_router import get_recipe_store
from app.dishes.router import get_store as get_dish_store
from app.main import app
from app.profile.router import get_store as get_profile_store

RECIPE_ID = str(uuid4())
RECIPE = {
    "id": RECIPE_ID,
    "name": "Борщ",
    "category": "обід",
    "kind": "суп",
    "recipe": "Варити",
    "ingredients": [{"name": "Буряк", "amount": "1 шт"}],
    "calories": 250,
    "protein_g": 9,
    "fat_g": 10,
    "carbs_g": 30,
    "diet": "any",
    "allergens": [],
    "cuisine": "ukrainian",
    "cook_minutes": 90,
    "budget": "medium",
}


class FakeRecipes:
    def list(self, query=""):
        return [RECIPE] if query.lower() in RECIPE["name"].lower() else []

    def get(self, recipe_id):
        return RECIPE if recipe_id == RECIPE_ID else None


class FakeProfiles:
    row = None

    def get(self, user_id):
        return self.row


class FakeDishes:
    def __init__(self):
        self.created = []

    def list(self):
        return [row for _, row in self.created]

    def create(self, user_id, data):
        row = {**data, "id": str(uuid4())}
        self.created.append((user_id, row))
        return row


@pytest.fixture
def client_and_dishes():
    dishes = FakeDishes()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_recipe_store] = lambda: FakeRecipes()
    app.dependency_overrides[get_dish_store] = lambda: dishes
    app.dependency_overrides[get_profile_store] = lambda: FakeProfiles()
    yield TestClient(app), dishes
    app.dependency_overrides.clear()


def test_list_and_search(client_and_dishes):
    client, _ = client_and_dishes
    assert client.get("/api/recipes").json()[0]["name"] == "Борщ"
    assert client.get("/api/recipes?q=піца").json() == []


def test_save_copies_recipe_into_my_dishes(client_and_dishes):
    client, dishes = client_and_dishes
    r = client.post(f"/api/recipes/{RECIPE_ID}/save")
    assert r.status_code == 201
    assert r.json()["name"] == "Борщ"
    user_id, data = dishes.created[0]
    assert user_id == "user-1"
    assert data["id"] and "category" not in data
    assert data["categories"] == ["обід", "суп"]  # the recipe's meal and kind become the dish's categories


def test_save_unknown_recipe_is_404(client_and_dishes):
    client, _ = client_and_dishes
    assert client.post(f"/api/recipes/{uuid4()}/save").status_code == 404


def test_for_me_filters_by_profile(client_and_dishes):
    client, _ = client_and_dishes
    vegan = {"diet": "vegan", "allergens": [], "cuisines": [], "cook_time": "any", "budget": "any"}
    profiles = FakeProfiles()
    profiles.row = vegan
    app.dependency_overrides[get_profile_store] = lambda: profiles
    assert client.get("/api/recipes?for_me=true").json() == []
    assert len(client.get("/api/recipes").json()) == 1


def test_saving_the_same_recipe_twice_does_not_make_a_second_dish(client_and_dishes):
    client, dishes = client_and_dishes
    first = client.post(f"/api/recipes/{RECIPE_ID}/save").json()
    second = client.post(f"/api/recipes/{RECIPE_ID}/save").json()
    assert second["id"] == first["id"]
    assert len(dishes.created) == 1
