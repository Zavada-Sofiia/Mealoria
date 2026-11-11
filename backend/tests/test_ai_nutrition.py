import pytest
from fastapi.testclient import TestClient

from app.ai_gateway import gemini
from app.ai_gateway import prompts
from app.ai_gateway import router as ai_router
from app.ai_gateway.router import get_plan_store, get_quota_store
from app.auth import current_user_id
from app.main import app
from tests.test_ai import FakeQuota

BODY = {"name": "Борщ", "ingredients": [{"name": "Буряк", "amount": "100 г"}, {"name": "Сіль", "amount": ""}]}
ANSWER = {"calories": 250, "protein_g": 9.5, "fat_g": 10, "carbs_g": 30}


class Plans:
    def __init__(self, plan="premium"):
        self.plan = plan

    def my_limits(self):
        return {"plan": self.plan, "ai_per_day": 2, "photos_per_day": 0}


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    quota, prompts_seen = FakeQuota(), []

    def fake_generate(prompt, schema, image_b64=None, mime_type="image/jpeg"):
        prompts_seen.append(prompt)
        return ANSWER

    monkeypatch.setattr(ai_router, "generate_json", fake_generate)
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_quota_store] = lambda: quota
    app.dependency_overrides[get_plan_store] = lambda: Plans()
    yield TestClient(app), quota, prompts_seen
    app.dependency_overrides.clear()


def test_premium_gets_nutrition_and_it_is_charged(env):
    client, quota, seen = env
    r = client.post("/api/ai/dish-nutrition", json=BODY)
    assert r.status_code == 200 and r.json() == ANSWER
    assert quota.used == 1
    assert "Борщ" in seen[0] and "Буряк (100 г)" in seen[0] and "Сіль" in seen[0]


def test_free_plan_is_refused_without_spending_anything(env):
    client, quota, seen = env
    app.dependency_overrides[get_plan_store] = lambda: Plans("free")
    r = client.post("/api/ai/dish-nutrition", json=BODY)
    assert r.status_code == 403 and r.json()["detail"] == "premium_required"
    assert seen == [] and quota.used == 0


def test_daily_limit_applies(env):
    client, quota, seen = env
    quota.used = 2
    assert client.post("/api/ai/dish-nutrition", json=BODY).status_code == 429
    assert seen == []


def test_failures_are_not_charged(env, monkeypatch):
    client, quota, _ = env

    def busy(*a, **k):
        raise gemini.AIBusy("[m] Gemini returned 503")

    monkeypatch.setattr(ai_router, "generate_json", busy)
    r = client.post("/api/ai/dish-nutrition", json=BODY)
    assert r.status_code == 502 and r.json()["detail"] == "AI is busy" and quota.used == 0

    monkeypatch.setattr(ai_router, "generate_json", lambda *a, **k: {"calories": -5})
    assert client.post("/api/ai/dish-nutrition", json=BODY).status_code == 502


def test_not_configured_is_503(env, monkeypatch):
    client, quota, _ = env
    monkeypatch.delenv("GEMINI_API_KEY")
    assert client.post("/api/ai/dish-nutrition", json=BODY).status_code == 503
    assert quota.used == 0


def test_input_validation(env):
    client, quota, seen = env
    assert client.post("/api/ai/dish-nutrition", json={"name": ""}).status_code == 422
    assert seen == [] and quota.used == 0


def test_prompt_without_ingredients_asks_for_a_typical_portion():
    assert "типовою порцією" in prompts.nutrition_prompt("Плов", [], "")
