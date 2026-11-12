import httpx
import pytest
from fastapi.testclient import TestClient

from app.admin import router as admin_router
from app.admin.router import NotAdmin, get_store
from app.auth import current_user_id
from app.main import app

STATS = {"users_total": 3, "daily": [], "users": []}


class FakeStore:
    def __init__(self, error=None):
        self.error = error

    def stats(self):
        if self.error:
            raise self.error
        return STATS


@pytest.fixture
def client():
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    yield TestClient(app)
    app.dependency_overrides.clear()


def use(store):
    app.dependency_overrides[get_store] = lambda: store


def test_admin_gets_stats(client):
    use(FakeStore())
    assert client.get("/api/admin/stats").json() == STATS


def test_non_admin_sees_plain_not_found(client):
    use(FakeStore(NotAdmin()))
    r = client.get("/api/admin/stats")
    assert r.status_code == 404 and r.json() == {"detail": "Not Found"}


def test_backend_problem_is_502(client):
    use(FakeStore(httpx.ConnectError("down")))
    assert client.get("/api/admin/stats").status_code == 502


def test_anonymous_is_rejected():
    assert TestClient(app).get("/api/admin/stats").status_code in (401, 403)


def test_store_maps_permission_errors(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "k")

    def fake_post(url, headers, json, timeout):
        return httpx.Response(403, request=httpx.Request("POST", url), json={"code": "42501"})

    monkeypatch.setattr(admin_router.httpx, "post", fake_post)
    with pytest.raises(NotAdmin):
        admin_router.SupabaseAdminStore("tok").stats()


class PremiumStore:
    def __init__(self):
        self.calls = []

    def grant_premium(self, email, months, days, unlimited):
        self.calls.append((email, months, days, unlimited))
        if email == "nobody@x.ua":
            return {"ok": False, "error": "user_not_found"}
        return {"ok": True, "was_active": True, "new_until": "2027-06-01T10:00:00Z", "unlimited": unlimited}

    def premium_history(self):
        return [{"email": "a@x.ua", "source": "admin", "months": 3}]

    def preorders_by_period(self):
        return [{"months": 3, "count": 2}]


def test_admin_grants_a_period_and_reads_the_history(client):
    store = PremiumStore()
    use(store)
    r = client.post("/api/admin/premium/grant", json={"email": " a@x.ua ", "months": 3})
    assert r.status_code == 200 and r.json()["new_until"] == "2027-06-01T10:00:00Z"
    assert store.calls == [("a@x.ua", 3, 0, False)]
    assert client.get("/api/admin/premium/history").json()[0]["months"] == 3
    assert client.get("/api/admin/preorders").json() == [{"months": 3, "count": 2}]


def test_grant_errors_and_limits(client):
    use(PremiumStore())
    assert client.post("/api/admin/premium/grant", json={"email": "nobody@x.ua", "months": 3}).json() == {"detail": "user_not_found"}
    assert client.post("/api/admin/premium/grant", json={"email": "a@x.ua", "months": 500}).status_code == 422
    assert client.post("/api/admin/premium/grant", json={"email": "a@x.ua", "months": -1}).status_code == 422


def test_non_admins_cannot_grant_or_read_the_history(client):
    class Refuse(PremiumStore):
        def grant_premium(self, *a):
            raise NotAdmin()

        def premium_history(self):
            raise NotAdmin()

    use(Refuse())
    assert client.post("/api/admin/premium/grant", json={"email": "a@x.ua", "months": 3}).status_code == 404
    assert client.get("/api/admin/premium/history").status_code == 404
