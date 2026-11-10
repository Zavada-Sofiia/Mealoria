from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.dishes.recipes_router import get_recipe_store
from app.dishes.router import get_store as get_dish_store
from app.main import app

RECIPE_ID = str(uuid4())
RECIPE = {
    "id": RECIPE_ID,
    "name": "Борщ",
    "category": "обід",
    "recipe": "Варити",
    "ingredients": [{"name": "Буряк", "amount": "1 шт"}],
    "calories": 250,
    "protein_g": 9,
    "fat_g": 10,
    "carbs_g": 30,
}


class FakeRecipes:
    def list(self, query=""):
        return [RECIPE] if query.lower() in RECIPE["name"].lower() else []

    def get(self, recipe_id):
        return RECIPE if recipe_id == RECIPE_ID else None


class FakeDishes:
    def __init__(self):
        self.created = []

    def create(self, user_id, data):
        self.created.append((user_id, data))
        return {**data, "id": str(uuid4())}


@pytest.fixture
def client_and_dishes():
    dishes = FakeDishes()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_recipe_store] = lambda: FakeRecipes()
    app.dependency_overrides[get_dish_store] = lambda: dishes
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
    assert "id" not in data and "category" not in data


def test_save_unknown_recipe_is_404(client_and_dishes):
    client, _ = client_and_dishes
    assert client.post(f"/api/recipes/{uuid4()}/save").status_code == 404
