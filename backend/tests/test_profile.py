import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.main import app
from app.profile.calc import bmr, recommended_calories
from app.profile.router import get_store

BODY = {
    "sex": "female",
    "age": 30,
    "height_cm": 165,
    "weight_kg": 60,
    "activity": "light",
    "goal": "maintain",
}


def test_bmr_known_values():
    assert bmr("male", 30, 180, 80) == pytest.approx(1780)
    assert bmr("female", 30, 165, 60) == pytest.approx(1320.25)


def test_recommended_calories_goal_adjustment():
    maintain = recommended_calories("female", 30, 165, 60, "light", "maintain")
    assert maintain == round(1320.25 * 1.375)
    assert recommended_calories("female", 30, 165, 60, "light", "lose") < maintain
    assert recommended_calories("female", 30, 165, 60, "light", "gain") > maintain


class FakeStore:
    def __init__(self):
        self.rows = {}

    def get(self, user_id):
        return self.rows.get(user_id)

    def save(self, user_id, data):
        self.rows[user_id] = data


@pytest.fixture
def client():
    store = FakeStore()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_empty_profile(client):
    assert client.get("/api/profile").json() == {
        "profile": None,
        "recommended_calories": None,
    }


def test_save_then_read(client):
    saved = client.put("/api/profile", json=BODY).json()
    assert saved["recommended_calories"] == 1815
    read = client.get("/api/profile").json()
    assert read["profile"]["age"] == 30
    assert read["profile"]["meals_per_day"] == 3


def test_validation(client):
    assert client.put("/api/profile", json={**BODY, "age": 5}).status_code == 422


def test_preference_questions_saved_and_validated(client):
    answers = {
        "diet": "vegetarian",
        "allergens": ["lactose", "nuts"],
        "cuisines": ["italian"],
        "cook_time": "30",
        "budget": "low",
    }
    client.put("/api/profile", json={**BODY, **answers})
    read = client.get("/api/profile").json()["profile"]
    assert {k: read[k] for k in answers} == answers

    defaults = client.put("/api/profile", json=BODY).json()["profile"]
    assert defaults["diet"] == "any" and defaults["allergens"] == []

    assert client.put("/api/profile", json={**BODY, "diet": "carnivore"}).status_code == 422
    assert client.put("/api/profile", json={**BODY, "allergens": ["pollen"]}).status_code == 422


def test_extended_allergens_are_accepted(client):
    extra = ["sesame", "mustard", "celery", "honey", "citrus", "berries", "cocoa",
             "mushrooms", "corn", "legumes", "tomatoes"]
    r = client.put("/api/profile", json={**BODY, "allergens": ["gluten", *extra]})
    assert r.status_code == 200 and len(r.json()["profile"]["allergens"]) == 12
