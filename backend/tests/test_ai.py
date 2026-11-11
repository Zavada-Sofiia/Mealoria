import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai_gateway import gemini, prompts
from app.ai_gateway import router as ai_router
from app.ai_gateway.router import get_quota_store
from app.auth import current_user_id
from app.main import app
from app.profile.router import get_store as get_profile_store

PHOTO = {"image_base64": "A" * 200, "mime_type": "image/jpeg"}
MEAL = {
    "is_food": True, "name": "Борщ", "calories": 250, "protein_g": 9, "fat_g": 10,
    "carbs_g": 30, "ingredients": [{"name": "Буряк", "amount": "100 г"}], "comment": "",
}
IDEAS = {"recipes": [{
    "name": "Омлет", "category": "сніданок", "calories": 280, "protein_g": 19, "fat_g": 20,
    "carbs_g": 5, "cook_minutes": 10, "ingredients": [{"name": "Яйця", "amount": "3 шт"}],
    "recipe": "Збийте й засмажте.",
}]}


class FakeQuota:
    admin = False

    def __init__(self, used=0):
        self.used = used

    def is_admin(self):
        return self.admin

    def status(self, limit):
        return {"used": self.used, "limit": limit}

    def consume(self, limit):
        if self.used >= limit:
            return {"allowed": False, "used": self.used, "limit": limit}
        self.used += 1
        return {"allowed": True, "used": self.used, "limit": limit}


class FakeProfiles:
    row = None

    def get(self, user_id):
        return self.row


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("AI_DAILY_LIMIT", "2")
    quota, profiles, calls = FakeQuota(), FakeProfiles(), []

    def fake_generate(prompt, schema, image_b64=None, mime_type="image/jpeg"):
        calls.append((prompt, image_b64))
        return MEAL if image_b64 else IDEAS

    monkeypatch.setattr(ai_router, "generate_json", fake_generate)
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_quota_store] = lambda: quota
    app.dependency_overrides[get_profile_store] = lambda: profiles
    yield TestClient(app), quota, profiles, calls
    app.dependency_overrides.clear()


def test_meal_photo_and_recipes_work_and_use_quota(env):
    client, quota, _, calls = env
    assert client.post("/api/ai/meal-photo", json=PHOTO).json()["name"] == "Борщ"
    assert client.post("/api/ai/recipes", json={}).json()["recipes"][0]["name"] == "Омлет"
    assert quota.used == 2 and len(calls) == 2
    assert client.get("/api/ai/quota").json() == {"used": 2, "limit": 2}


def test_limit_blocks_before_calling_gemini(env):
    client, quota, _, calls = env
    quota.used = 2
    assert client.post("/api/ai/recipes", json={}).status_code == 429
    assert calls == []


def test_missing_api_key_is_503_and_does_not_spend_quota(env, monkeypatch):
    client, quota, _, _ = env
    monkeypatch.delenv("GEMINI_API_KEY")
    assert client.post("/api/ai/recipes", json={}).status_code == 503
    assert quota.used == 0


def test_bad_model_answer_is_502(env, monkeypatch):
    client, _, _, _ = env
    monkeypatch.setattr(ai_router, "generate_json", lambda *a, **k: {"recipes": [{"name": ""}]})
    assert client.post("/api/ai/recipes", json={}).status_code == 502

    def boom(*a, **k):
        raise gemini.AIError("down")

    monkeypatch.setattr(ai_router, "generate_json", boom)
    assert client.post("/api/ai/meal-photo", json=PHOTO).status_code == 502


def test_input_validation(env):
    client, quota, _, _ = env
    assert client.post("/api/ai/meal-photo", json={"image_base64": "x"}).status_code == 422
    assert client.post("/api/ai/meal-photo", json={**PHOTO, "mime_type": "image/gif"}).status_code == 422
    assert client.post("/api/ai/recipes", json={"note": "x" * 201}).status_code == 422
    assert quota.used == 0


def test_recipe_prompt_contains_profile_restrictions(env):
    client, _, profiles, calls = env
    profiles.row = {
        "diet": "vegan", "allergens": ["nuts", "soy"], "cuisines": ["italian"], "cook_time": "30",
        "budget": "low", "target_calories": 1800, "meals_per_day": 3,
        "preferences": "не люблю гриби", "allergies": "",
    }
    client.post("/api/ai/recipes", json={"category": "обід", "note": "щось легке"})
    prompt = calls[0][0]
    for part in ["веганське", "горіхи", "соя", "італійська", "30 хвилин", "600 ккал", "обід", "гриби", "щось легке"]:
        assert part in prompt


def test_prompt_without_profile_still_works():
    assert "3 різні" in prompts.recipe_prompt(None, None, "")


def test_generate_json_parses_gemini_response(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    seen = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, key=headers["x-goog-api-key"], body=json)
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={"candidates": [{"content": {"parts": [{"text": '{"a": 1}'}]}}]},
        )

    monkeypatch.setattr(gemini.httpx, "post", fake_post)
    assert gemini.generate_json("hi", {"type": "OBJECT"}, "QUJD") == {"a": 1}
    assert seen["key"] == "k" and "gemini-flash-lite-latest:generateContent" in seen["url"]
    parts = seen["body"]["contents"][0]["parts"]
    assert parts[1]["inline_data"]["data"] == "QUJD"


def _resp(url, status, text="", payload=None):
    return httpx.Response(status, request=httpx.Request("POST", url), text=text, json=payload) if payload else \
        httpx.Response(status, request=httpx.Request("POST", url), text=text)


OK = {"candidates": [{"content": {"parts": [{"text": '{"a": 1}'}]}}]}


def test_overloaded_model_falls_back_to_the_next_one(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv("GEMINI_FALLBACK_MODELS", raising=False)
    tried = []

    def fake_post(url, headers, json, timeout):
        tried.append(url.split("/models/")[1].split(":")[0])
        if len(tried) == 1:
            return httpx.Response(503, request=httpx.Request("POST", url), text="high demand")
        return httpx.Response(200, request=httpx.Request("POST", url), json=OK)

    monkeypatch.setattr(gemini.httpx, "post", fake_post)
    assert gemini.generate_json("hi", {}) == {"a": 1}
    assert tried == ["gemini-flash-lite-latest", "gemini-3.1-flash-lite"]


def test_timeout_also_falls_back(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append(url)
        if len(calls) == 1:
            raise httpx.ReadTimeout("slow")
        return httpx.Response(200, request=httpx.Request("POST", url), json=OK)

    monkeypatch.setattr(gemini.httpx, "post", fake_post)
    assert gemini.generate_json("hi", {}) == {"a": 1} and len(calls) == 2


def test_bad_key_does_not_retry(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append(url)
        return httpx.Response(400, request=httpx.Request("POST", url), text="API key not valid")

    monkeypatch.setattr(gemini.httpx, "post", fake_post)
    with pytest.raises(gemini.AIError, match="400.*API key not valid"):
        gemini.generate_json("hi", {})
    assert len(calls) == 1


def test_all_models_failing_lists_every_reason(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setenv("GEMINI_MODEL", "m1")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "m2, m3, m4")

    def fake_post(url, headers, json, timeout):
        return httpx.Response(503, request=httpx.Request("POST", url), text="busy")

    monkeypatch.setattr(gemini.httpx, "post", fake_post)
    with pytest.raises(gemini.AIError) as err:
        gemini.generate_json("hi", {})
    text = str(err.value)
    assert "[m1]" in text and "[m2]" in text and "[m3]" in text and "[m4]" not in text


def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(gemini.AIError):
        gemini.generate_json("hi", {})


def test_only_admins_see_the_technical_reason(env, monkeypatch):
    client, quota, _, _ = env

    def boom(*a, **k):
        raise gemini.AIError("Gemini returned 429: quota")

    monkeypatch.setattr(ai_router, "generate_json", boom)
    assert client.post("/api/ai/recipes", json={}).json()["detail"] == "AI could not suggest recipes"
    quota.admin = True
    detail = client.post("/api/ai/recipes", json={}).json()["detail"]
    assert detail == "AI could not suggest recipes: AIError: Gemini returned 429: quota"


def test_unexpected_errors_still_return_a_readable_502(env, monkeypatch):
    client, quota, profiles, _ = env
    profiles.row = {"diet": "any", "allergens": None, "target_calories": "oops", "meals_per_day": 0}

    def explode(*a, **k):
        raise RuntimeError("something unforeseen")

    monkeypatch.setattr(ai_router, "generate_json", explode)
    quota.admin = True
    r = client.post("/api/ai/recipes", json={})
    assert r.status_code == 502
    assert "RuntimeError: something unforeseen" in r.json()["detail"]
    quota.admin = False
    assert client.post("/api/ai/meal-photo", json=PHOTO).json()["detail"] == "AI could not analyse the photo"
