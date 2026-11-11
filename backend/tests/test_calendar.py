import datetime as dt
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.calendar.router import get_store
from app.main import app

DISH_ID = str(uuid4())


class FakeStore:
    def __init__(self):
        self.rows = {}

    def _row(self, entry_id, date, slot):
        return {
            "id": entry_id,
            "date": date,
            "slot": slot,
            "dish": {"id": DISH_ID, "name": "Борщ", "calories": 250},
        }

    def list(self, start, end):
        return [
            r for r in self.rows.values() if start <= dt.date.fromisoformat(r["date"]) < end
        ]

    def create(self, user_id, data):
        row = self._row(str(uuid4()), data["date"], data["slot"])
        self.rows[row["id"]] = row
        return row

    def move(self, entry_id, data):
        if entry_id not in self.rows:
            return None
        self.rows[entry_id] = self._row(entry_id, data["date"], data["slot"])
        return self.rows[entry_id]

    def create_many(self, user_id, rows):
        for data in rows:
            self.create(user_id, data)

    def delete(self, entry_id):
        return self.rows.pop(entry_id, None) is not None


@pytest.fixture
def client():
    store = FakeStore()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_add_move_and_week_range(client):
    entry = client.post(
        "/api/calendar", json={"date": "2026-11-10", "slot": 0, "dish_id": DISH_ID}
    ).json()
    assert client.get("/api/calendar?start=2026-11-09").json()[0]["dish"]["name"] == "Борщ"
    assert client.get("/api/calendar?start=2026-11-16").json() == []

    moved = client.put(
        f"/api/calendar/{entry['id']}", json={"date": "2026-11-18", "slot": 2}
    ).json()
    assert (moved["date"], moved["slot"]) == ("2026-11-18", 2)
    assert client.get("/api/calendar?start=2026-11-09").json() == []


def test_delete_and_missing(client):
    entry = client.post(
        "/api/calendar", json={"date": "2026-11-10", "slot": 1, "dish_id": DISH_ID}
    ).json()
    assert client.delete(f"/api/calendar/{entry['id']}").status_code == 204
    assert client.delete(f"/api/calendar/{entry['id']}").status_code == 404
    body = {"date": "2026-11-10", "slot": 0}
    assert client.put(f"/api/calendar/{uuid4()}", json=body).status_code == 404


def test_validation(client):
    bad = {"date": "2026-11-10", "slot": 9, "dish_id": DISH_ID}
    assert client.post("/api/calendar", json=bad).status_code == 422
    assert client.get("/api/calendar").status_code == 422


def test_copy_previous_week_skips_what_is_already_there(client):
    client.post("/api/calendar", json={"date": "2026-11-09", "slot": 0, "dish_id": DISH_ID})
    client.post("/api/calendar", json={"date": "2026-11-10", "slot": 2, "dish_id": DISH_ID})
    client.post("/api/calendar", json={"date": "2026-11-16", "slot": 0, "dish_id": DISH_ID})

    week = client.post("/api/calendar/copy-week?start=2026-11-16").json()
    assert sorted((e["date"], e["slot"]) for e in week) == [("2026-11-16", 0), ("2026-11-17", 2)]
    # a second copy adds nothing
    again = client.post("/api/calendar/copy-week?start=2026-11-16").json()
    assert len(again) == 2
