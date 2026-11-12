import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.limits.router import get_store
from app.main import app


class FakeStore:
    def __init__(self):
        self.users = {}

    def get(self, user_id):
        return {"user_id": user_id, "months": self.users[user_id]} if user_id in self.users else None

    def add(self, user_id, months=None):
        self.users[user_id] = months


@pytest.fixture
def client():
    store = FakeStore()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app), store
    app.dependency_overrides.clear()


def test_preorder_flow_is_idempotent(client):
    c, store = client
    assert c.get("/api/preorder").json() == {"preordered": False, "months": None}
    assert c.post("/api/preorder").status_code == 201
    assert c.post("/api/preorder").status_code == 201
    assert c.get("/api/preorder").json() == {"preordered": True, "months": 1}
    assert set(store.users) == {"user-1"}


def test_the_chosen_period_is_saved_and_can_be_changed(client):
    c, store = client
    assert c.post("/api/preorder", json={"months": 6}).json() == {"preordered": True, "months": 6}
    assert c.get("/api/preorder").json()["months"] == 6
    assert c.post("/api/preorder", json={"months": 12}).status_code == 201
    assert store.users == {"user-1": 12}


def test_only_the_offered_periods_are_accepted(client):
    c, store = client
    for bad in (0, 2, 5, 24):
        assert c.post("/api/preorder", json={"months": bad}).status_code == 422
    assert store.users == {}


def test_requires_login():
    assert TestClient(app).post("/api/preorder").status_code in (401, 403)
