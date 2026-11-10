import datetime as dt
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.main import app
from app.shopping.aggregate import build_items
from app.shopping.router import get_store


def dish(*ingredients):
    return {"dish": {"name": "x", "ingredients": [{"name": n, "amount": a} for n, a in ingredients]}}


def test_sums_same_unit_and_keeps_different_units():
    plan = [
        dish(("Картопля", "2 шт"), ("Молоко", "150 мл")),
        dish(("картопля ", "1 шт"), ("Молоко", "1 склянка")),
    ]
    items, _ = build_items(plan, set(), set())
    by_name = {i["name"]: i["amount"] for i in items}
    assert by_name["Картопля"] == "3 шт"
    assert by_name["Молоко"] == "150 мл + 1 склянка"


def test_decimals_comma_and_unparsed_amounts():
    plan = [
        dish(("Банан", "0,5 шт"), ("Кориця", "щіпка")),
        dish(("Банан", "1 шт"), ("Кориця", "щіпка")),
    ]
    by_name = {i["name"]: i["amount"] for i in build_items(plan, set(), set())[0]}
    assert by_name["Банан"] == "1.5 шт"
    assert by_name["Кориця"] == "щіпка ×2"


def test_pantry_removes_items_and_checks_are_marked():
    plan = [dish(("Сіль", "1 ч. л."), ("Яйця", "3 шт"))]
    items, home = build_items(plan, {"сіль"}, {"яйця"})
    assert home == ["Сіль"]
    assert items == [{"name": "Яйця", "amount": "3 шт", "checked": True}]


def test_entries_without_dish_are_ignored():
    assert build_items([{"dish": None}], set(), set()) == ([], [])


class FakeStore:
    def __init__(self):
        self.pantry_rows = {}
        self.checked = set()

    def plan(self, start, end):
        return [dish(("Яйця", "3 шт"), ("Сіль", "1 ч. л."))]

    def pantry(self):
        return [{"id": i, "name": n} for i, n in self.pantry_rows.items()]

    def pantry_add(self, user_id, name):
        self.pantry_rows[str(uuid4())] = name

    def pantry_delete(self, item_id):
        self.pantry_rows.pop(item_id, None)

    def checks(self, start):
        return list(self.checked)

    def set_check(self, user_id, start, name, checked):
        (self.checked.add if checked else self.checked.discard)(name)


@pytest.fixture
def client():
    store = FakeStore()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_list_check_and_pantry_flow(client):
    names = lambda r: [i["name"] for i in r["items"]]
    assert names(client.get("/api/shopping?start=2026-11-09").json()) == ["Сіль", "Яйця"]

    client.put("/api/shopping/check", json={"start": "2026-11-09", "name": "Яйця", "checked": True})
    items = client.get("/api/shopping?start=2026-11-09").json()["items"]
    assert [i["checked"] for i in items if i["name"] == "Яйця"] == [True]

    pantry = client.post("/api/shopping/pantry", json={"name": "  Сіль "}).json()
    assert pantry[0]["name"] == "сіль"
    data = client.get("/api/shopping?start=2026-11-09").json()
    assert names(data) == ["Яйця"] and data["at_home"] == ["Сіль"]

    assert client.delete(f"/api/shopping/pantry/{pantry[0]['id']}").status_code == 204
    assert names(client.get("/api/shopping?start=2026-11-09").json()) == ["Сіль", "Яйця"]
