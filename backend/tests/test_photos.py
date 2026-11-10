import pytest
from fastapi.testclient import TestClient

from app.auth import current_user_id
from app.dishes.router import get_store
from app.main import app

from tests.test_dishes import DISH, FakeStore

BASE = "https://example.supabase.co/storage/v1/object/public/dish-photos"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co.")
    store = FakeStore()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "url",
    [f"{BASE}/user-1/a.jpg", f"{BASE}/recipes/borsch.jpg"],
)
def test_own_and_catalog_photos_are_accepted(client, url):
    r = client.post("/api/dishes", json={**DISH, "photo_url": url})
    assert r.status_code == 201 and r.json()["photo_url"] == url


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.example/pixel.png",
        f"{BASE}/user-2/a.jpg",
        f"{BASE}/user-1/../user-2/a.jpg",
        "https://example.supabase.co/storage/v1/object/public/other/user-1/a.jpg",
    ],
)
def test_foreign_photo_urls_are_rejected(client, url):
    assert client.post("/api/dishes", json={**DISH, "photo_url": url}).status_code == 422


def test_update_checks_photo_too(client):
    dish_id = client.post("/api/dishes", json=DISH).json()["id"]
    bad = {**DISH, "photo_url": "https://evil.example/x.png"}
    assert client.put(f"/api/dishes/{dish_id}", json=bad).status_code == 422
    assert client.post("/api/dishes", json=DISH).json()["photo_url"] is None
