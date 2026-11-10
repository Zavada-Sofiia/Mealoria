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
