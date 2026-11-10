import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.limits.router import get_store
from app.main import app


class FakeStore:
    def __init__(self):
        self.users = set()

    def exists(self, user_id):
        return user_id in self.users

    def add(self, user_id):
        self.users.add(user_id)


@pytest.fixture
def client():
    store = FakeStore()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app), store
    app.dependency_overrides.clear()


def test_preorder_flow_is_idempotent(client):
    c, store = client
    assert c.get("/api/preorder").json() == {"preordered": False}
    assert c.post("/api/preorder").status_code == 201
    assert c.post("/api/preorder").status_code == 201
    assert c.get("/api/preorder").json() == {"preordered": True}
    assert store.users == {"user-1"}


def test_requires_login():
    assert TestClient(app).post("/api/preorder").status_code in (401, 403)
