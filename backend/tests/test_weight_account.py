import datetime as dt

import httpx
import pytest
from fastapi.testclient import TestClient

from app.account.router import get_store as get_account_store
from app.auth import current_user_id
from app.main import app
from app.weight.router import get_store as get_weight_store

TODAY = dt.date.today()


class FakeWeights:
    def __init__(self):
        self.rows = {}

    def list(self, since):
        return [{"day": d.isoformat(), "weight_kg": w} for d, w in sorted(self.rows.items()) if d >= since]

    def upsert(self, user_id, day, weight_kg):
        self.rows[day] = weight_kg
        return {"day": day.isoformat(), "weight_kg": weight_kg}

    def delete(self, day):
        return self.rows.pop(day, None) is not None


class FakeAccount:
    def __init__(self, fail=False):
        self.calls = []
        self.fail = fail

    def delete_photos(self, user_id):
        self.calls.append(("photos", user_id))

    def delete_account(self):
        if self.fail:
            raise httpx.ConnectError("down")
        self.calls.append(("account",))


@pytest.fixture
def client():
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_weight_journal(client):
    store = FakeWeights()
    app.dependency_overrides[get_weight_store] = lambda: store
    day = TODAY.isoformat()
    assert client.put("/api/weight", json={"day": day, "weight_kg": 62.5}).status_code == 200
    assert client.put("/api/weight", json={"day": day, "weight_kg": 62.0}).json()["weight_kg"] == 62.0
    assert client.get("/api/weight").json() == [{"day": day, "weight_kg": 62.0}]
    assert client.delete(f"/api/weight/{day}").status_code == 204
    assert client.delete(f"/api/weight/{day}").status_code == 404


def test_weight_validation(client):
    app.dependency_overrides[get_weight_store] = lambda: FakeWeights()
    assert client.put("/api/weight", json={"day": TODAY.isoformat(), "weight_kg": 5}).status_code == 422
    future = (TODAY + dt.timedelta(days=30)).isoformat()
    assert client.put("/api/weight", json={"day": future, "weight_kg": 60}).status_code == 422


def test_delete_account_removes_photos_then_the_account(client):
    store = FakeAccount()
    app.dependency_overrides[get_account_store] = lambda: store
    assert client.delete("/api/account").status_code == 204
    assert store.calls == [("photos", "user-1"), ("account",)]


def test_delete_account_failure_is_a_clean_502(client):
    app.dependency_overrides[get_account_store] = lambda: FakeAccount(fail=True)
    assert client.delete("/api/account").status_code == 502
