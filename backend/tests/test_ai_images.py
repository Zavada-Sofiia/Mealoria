import base64

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai_gateway import images
from app.ai_gateway import router as ai_router
from app.ai_gateway.images import ImageBusy, ImageError
from app.ai_gateway.router import get_image_quota_store, get_plan_store, get_quota_store
from app.auth import current_user_id
from app.main import app

IMAGE = base64.b64encode(b"fake-jpeg").decode()
BODY = {"name": "Борщ", "ingredients": [{"name": "Буряк", "amount": "100 г"}]}


class FakeQuota:
    admin = False

    def __init__(self, used=0):
        self.used = used

    def is_admin(self):
        return self.admin

    def status(self, limit):
        return {"used": self.used, "limit": limit}

    def consume(self, limit):
        self.used += 1
        return {"allowed": True, "used": self.used, "limit": limit}


class Plans:
    def __init__(self, photos):
        self.photos = photos

    def my_limits(self):
        return {"plan": "premium" if self.photos else "free", "ai_per_day": 5, "photos_per_day": self.photos}


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("CF_ACCOUNT_ID", "a" * 32)
    monkeypatch.setenv("CF_API_TOKEN", "t")
    spent, calls = FakeQuota(), []

    def draw(description):
        calls.append(description)
        return IMAGE

    monkeypatch.setattr(ai_router, "generate_image", draw)
    monkeypatch.setattr(ai_router, "generate_json", lambda *a, **k: {"description": "a bowl of red borscht"})
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_image_quota_store] = lambda: spent
    app.dependency_overrides[get_quota_store] = lambda: FakeQuota()
    app.dependency_overrides[get_plan_store] = lambda: Plans(10)
    yield TestClient(app), spent, calls
    app.dependency_overrides.clear()


def test_premium_gets_an_image_and_it_is_charged(env):
    client, spent, calls = env
    r = client.post("/api/ai/dish-image", json=BODY)
    assert r.status_code == 200 and r.json()["image_base64"] == IMAGE
    assert calls == ["a bowl of red borscht"] and spent.used == 1


def test_free_plan_is_refused_without_calling_anything(env):
    client, spent, calls = env
    app.dependency_overrides[get_plan_store] = lambda: Plans(0)
    r = client.post("/api/ai/dish-image", json=BODY)
    assert r.status_code == 403 and r.json()["detail"] == "premium_required"
    assert calls == [] and spent.used == 0


def test_daily_photo_limit(env):
    client, spent, calls = env
    spent.used = 10
    assert client.post("/api/ai/dish-image", json=BODY).status_code == 429
    assert calls == []


def test_not_configured_is_503_and_free(env, monkeypatch):
    client, spent, _ = env
    monkeypatch.delenv("CF_API_TOKEN")
    assert client.post("/api/ai/dish-image", json=BODY).status_code == 503
    assert spent.used == 0


def test_failure_is_not_charged_and_busy_is_friendly(env, monkeypatch):
    client, spent, _ = env

    def busy(description):
        raise ImageBusy("Cloudflare returned 429")

    monkeypatch.setattr(ai_router, "generate_image", busy)
    r = client.post("/api/ai/dish-image", json=BODY)
    assert r.status_code == 502 and r.json()["detail"] == "AI is busy"
    assert spent.used == 0
    spent.admin = True
    assert "ImageBusy: Cloudflare returned 429" in client.post("/api/ai/dish-image", json=BODY).json()["detail"]


def test_gemini_failure_falls_back_to_the_dish_name(env, monkeypatch):
    client, _, calls = env

    def broken(*a, **k):
        raise RuntimeError("gemini down")

    monkeypatch.setattr(ai_router, "generate_json", broken)
    assert client.post("/api/ai/dish-image", json=BODY).status_code == 200
    assert calls == ["Борщ"]


def test_input_validation(env):
    client, spent, calls = env
    assert client.post("/api/ai/dish-image", json={"name": ""}).status_code == 422
    assert calls == [] and spent.used == 0


def test_quota_reports_photo_usage_for_premium_only(env):
    client, spent, _ = env
    spent.used = 3
    assert client.get("/api/ai/quota").json()["images_used"] == 3
    app.dependency_overrides[get_plan_store] = lambda: Plans(0)
    data = client.get("/api/ai/quota").json()
    assert data["images_limit"] == 0 and data["images_used"] == 0


# ---- the Cloudflare client itself

def _cf(monkeypatch, response):
    monkeypatch.setenv("CF_ACCOUNT_ID", "acc")
    monkeypatch.setenv("CF_API_TOKEN", "tok")
    seen = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, auth=headers["Authorization"], body=json)
        return response

    monkeypatch.setattr(images.httpx, "post", fake_post)
    return seen


def test_cloudflare_success(monkeypatch):
    req = httpx.Request("POST", "http://x")
    seen = _cf(monkeypatch, httpx.Response(200, request=req, json={"success": True, "result": {"image": IMAGE}}))
    assert images.generate_image("a bowl of soup") == IMAGE
    assert seen["auth"] == "Bearer tok" and "flux-1-schnell" in seen["url"]
    assert seen["body"]["prompt"].startswith("a bowl of soup, appetizing")


@pytest.mark.parametrize(
    "status,payload,expected",
    [
        (429, {"success": False, "errors": ["rate"]}, ImageBusy),
        (503, {"success": False, "errors": []}, ImageBusy),
        (400, {"success": False, "errors": [{"message": "daily neuron limit reached"}]}, ImageBusy),
        (401, {"success": False, "errors": [{"message": "Authentication error"}]}, ImageError),
        (200, {"success": True, "result": {}}, ImageError),
    ],
)
def test_cloudflare_failures(monkeypatch, status, payload, expected):
    _cf(monkeypatch, httpx.Response(status, request=httpx.Request("POST", "http://x"), json=payload))
    with pytest.raises(expected) as err:
        images.generate_image("x")
    assert type(err.value) is expected


def test_cloudflare_timeout_is_busy(monkeypatch):
    monkeypatch.setenv("CF_ACCOUNT_ID", "a")
    monkeypatch.setenv("CF_API_TOKEN", "t")

    def slow(url, headers, json, timeout):
        raise httpx.ReadTimeout("slow")

    monkeypatch.setattr(images.httpx, "post", slow)
    with pytest.raises(ImageBusy):
        images.generate_image("x")
