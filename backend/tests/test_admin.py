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
