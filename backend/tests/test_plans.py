import httpx
import pytest
from fastapi.testclient import TestClient

from app.admin.router import NotAdmin
from app.admin.router import get_store as get_admin_store
from app.auth import current_user_id
from app.calendar.router import get_store as get_calendar_store
from app.dishes.router import get_store as get_dish_store
from app.limits import plan_router
from app.limits.plan_router import get_plan_store
from app.limits.plans import raise_if_plan_limit
from app.main import app

DISH = {"name": "Борщ"}
TABLE = {
    "free": {"dishes": 15, "ai_per_day": 3, "plan_days_ahead": 14},
    "premium": {"dishes": 500, "ai_per_day": 50, "plan_days_ahead": 365},
}


def db_error(message, status=400):
    return httpx.HTTPStatusError(
        "refused",
        request=httpx.Request("POST", "http://x"),
        response=httpx.Response(
            status, request=httpx.Request("POST", "http://x"),
            json={"code": "P0001", "message": message},
        ),
    )


class FakePlans:
    def my_limits(self):
        return {"plan": "free", **TABLE["free"], "premium_until": None}


class FakeDishes:
    def __init__(self, error=None):
        self.error = error

    def list(self):
        return [{"id": "1"}, {"id": "2"}]

    def create(self, user_id, data):
        if self.error:
            raise self.error
        return {**data, "id": "3", "recipe": "", "ingredients": []}


@pytest.fixture
def client():
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_my_plan_reports_limits_and_usage(client):
    app.dependency_overrides[get_plan_store] = lambda: FakePlans()
    app.dependency_overrides[get_dish_store] = lambda: FakeDishes()
    data = client.get("/api/plan").json()
    assert data["plan"] == "free" and data["dishes"] == 15 and data["dishes_used"] == 2


def test_plan_table_is_public(monkeypatch):
    monkeypatch.setattr(
        plan_router, "SupabasePlanStore", lambda *a: type("S", (), {"plan_table": lambda self: TABLE})()
    )
    assert TestClient(app).get("/api/plans").json() == TABLE


def test_database_refusal_becomes_403_with_the_reason():
    with pytest.raises(Exception) as err:
        raise_if_plan_limit(db_error("plan_limit:dishes"))
    assert err.value.status_code == 403 and err.value.detail == "plan_limit:dishes"
    raise_if_plan_limit(db_error("some other database error"))  # not a plan limit: no exception


def test_creating_a_dish_over_the_limit_is_403(client):
    app.dependency_overrides[get_dish_store] = lambda: FakeDishes(db_error("plan_limit:dishes"))
    r = client.post("/api/dishes", json=DISH)
    assert r.status_code == 403 and r.json()["detail"] == "plan_limit:dishes"


def test_planning_too_far_ahead_is_403(client):
    class Calendar:
        def create(self, user_id, data):
            raise db_error("plan_limit:plan_days")

    app.dependency_overrides[get_calendar_store] = lambda: Calendar()
    body = {"date": "2030-01-01", "slot": 0, "dish_id": "00000000-0000-0000-0000-000000000001"}
    r = client.post("/api/calendar", json=body)
    assert r.status_code == 403 and r.json()["detail"] == "plan_limit:plan_days"


class FakeAdmin:
    def __init__(self, admin=True):
        self.admin = admin
        self.calls = []

    def _guard(self):
        if not self.admin:
            raise NotAdmin

    def premium_users(self):
        self._guard()
        return [{"email": "a@b.c", "active": True, "premium_until": None}]

    def set_plan(self, email, plan, days):
        self._guard()
        self.calls.append((email, plan, days))
        if email == "nobody@x.y":
            return {"ok": False, "error": "user_not_found"}
        return {"ok": True, "email": email, "plan": plan}


def test_admin_can_grant_premium(client):
    fake = FakeAdmin()
    app.dependency_overrides[get_admin_store] = lambda: fake
    r = client.post("/api/admin/plan", json={"email": " a@b.c ", "plan": "premium", "days": 30})
    assert r.json()["ok"] and fake.calls == [("a@b.c", "premium", 30)]
    assert client.get("/api/admin/premium").json()[0]["email"] == "a@b.c"


def test_unknown_user_and_bad_input(client):
    app.dependency_overrides[get_admin_store] = lambda: FakeAdmin()
    r = client.post("/api/admin/plan", json={"email": "nobody@x.y", "plan": "premium"})
    assert r.status_code == 422 and r.json()["detail"] == "user_not_found"
    assert client.post("/api/admin/plan", json={"email": "a@b.c", "plan": "gold"}).status_code == 422
    assert client.post("/api/admin/plan", json={"email": "a@b.c", "plan": "premium", "days": 0}).status_code == 422


def test_non_admins_get_plain_not_found(client):
    app.dependency_overrides[get_admin_store] = lambda: FakeAdmin(admin=False)
    assert client.get("/api/admin/premium").status_code == 404
    assert client.post("/api/admin/plan", json={"email": "a@b.c", "plan": "premium"}).status_code == 404
