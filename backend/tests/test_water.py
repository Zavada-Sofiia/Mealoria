import datetime as dt
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.main import app
from app.water.router import get_store

TODAY = dt.date.today().isoformat()


class FakeStore:
    def __init__(self):
        self.rows = []

    def for_day(self, day):
        return [r for r in self.rows if r["day"] == day.isoformat()]

    def add(self, user_id, day, amount_ml):
        row = {"id": str(uuid4()), "amount_ml": amount_ml, "created_at": "2026-11-12T10:00:00Z", "day": day.isoformat()}
        self.rows.append(row)
        return row

    def delete(self, entry_id):
        before = len(self.rows)
        self.rows = [r for r in self.rows if r["id"] != entry_id]
        return len(self.rows) < before


@pytest.fixture
def client():
    store = FakeStore()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_glasses_add_up_for_the_day_and_can_be_removed(client):
    first = client.post("/api/water", json={"day": TODAY, "amount_ml": 250}).json()
    client.post("/api/water", json={"day": TODAY, "amount_ml": 500})
    day = client.get(f"/api/water?day={TODAY}").json()
    assert day["total_ml"] == 750 and [e["amount_ml"] for e in day["entries"]] == [250, 500]

    assert client.delete(f"/api/water/{first['id']}").status_code == 204
    assert client.get(f"/api/water?day={TODAY}").json()["total_ml"] == 500
    assert client.delete(f"/api/water/{first['id']}").status_code == 404


def test_other_days_are_separate(client):
    client.post("/api/water", json={"day": "2026-11-01", "amount_ml": 300})
    assert client.get(f"/api/water?day={TODAY}").json() == {"total_ml": 0, "entries": []}


def test_validation(client):
    assert client.post("/api/water", json={"day": TODAY, "amount_ml": 5}).status_code == 422
    assert client.post("/api/water", json={"day": TODAY, "amount_ml": 5000}).status_code == 422
    future = (dt.date.today() + dt.timedelta(days=30)).isoformat()
    assert client.post("/api/water", json={"day": future, "amount_ml": 250}).status_code == 422
    assert client.get("/api/water").status_code == 422
