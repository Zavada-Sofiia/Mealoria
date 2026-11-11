from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.dishes.router import get_store
from app.main import app


class FakeStore:
    def __init__(self):
        self.rows = {}

    def list(self):
        return list(self.rows.values())

    def create(self, user_id, data):
        row = {**data, "id": str(uuid4())}
        self.rows[row["id"]] = row
        return row

    def update(self, dish_id, data):
        if dish_id not in self.rows:
            return None
        self.rows[dish_id] = {**data, "id": dish_id}
        return self.rows[dish_id]

    def delete(self, dish_id):
        return self.rows.pop(dish_id, None) is not None


@pytest.fixture
def client():
    store = FakeStore()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


DISH = {
    "name": "Борщ",
    "recipe": "Варити 1 годину",
    "ingredients": [{"name": "Буряк", "amount": "2 шт"}],
    "calories": 250,
    "protein_g": 8.5,
    "fat_g": 10,
    "carbs_g": 30,
}


def test_create_and_list(client):
    created = client.post("/api/dishes", json=DISH)
    assert created.status_code == 201
    assert created.json()["name"] == "Борщ"
    assert created.json()["protein_g"] == 8.5
    assert [d["name"] for d in client.get("/api/dishes").json()] == ["Борщ"]


def test_update_and_delete(client):
    dish_id = client.post("/api/dishes", json=DISH).json()["id"]
    r = client.put(f"/api/dishes/{dish_id}", json={**DISH, "name": "Борщ червоний"})
    assert r.json()["name"] == "Борщ червоний"
    assert client.delete(f"/api/dishes/{dish_id}").status_code == 204
    assert client.get("/api/dishes").json() == []


def test_missing_dish_is_404(client):
    missing = str(uuid4())
    assert client.put(f"/api/dishes/{missing}", json=DISH).status_code == 404
    assert client.delete(f"/api/dishes/{missing}").status_code == 404


def test_validation(client):
    assert client.post("/api/dishes", json={**DISH, "name": ""}).status_code == 422
    assert client.put("/api/dishes/not-a-uuid", json=DISH).status_code == 422


def test_macros_are_optional_and_validated(client):
    bare = {"name": "Чай"}
    assert client.post("/api/dishes", json=bare).json()["protein_g"] is None
    assert client.post("/api/dishes", json={**bare, "fat_g": -1}).status_code == 422


def test_a_dish_can_suit_several_meals(client):
    body = {"name": "Омлет", "categories": ["сніданок", "перекус"]}
    created = client.post("/api/dishes", json=body).json()
    assert created["categories"] == ["сніданок", "перекус"]
    assert client.post("/api/dishes", json={"name": "Х"}).json()["categories"] == []
    assert client.post("/api/dishes", json={"name": "Х", "categories": ["полуденок"]}).status_code == 422


def test_fiber_is_optional_and_validated(client):
    assert client.post("/api/dishes", json={"name": "Х"}).json()["fiber_g"] is None
    assert client.post("/api/dishes", json={"name": "Х", "fiber_g": 6.5}).json()["fiber_g"] == 6.5
    assert client.post("/api/dishes", json={"name": "Х", "fiber_g": -1}).status_code == 422
