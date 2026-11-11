import pytest
from fastapi.testclient import TestClient

from app.ai_gateway import gemini, prompts
from app.ai_gateway import router as ai_router
from app.ai_gateway.router import get_plan_store, get_quota_store
from app.auth import current_user_id
from app.main import app
from app.profile.router import get_store as get_profile_store
from tests.test_ai import FakeQuota
from tests.test_ai_nutrition import Plans

BODY = {"name": "Сирники", "note": "без цукру"}
ANSWER = {
    "recipe": "1. Змішайте сир з яйцем.\n2. Обсмажте.",
    "ingredients": [{"name": "Сир кисломолочний", "amount": "150 г"}, {"name": "Яйце", "amount": "1 шт"}],
}


class Profiles:
    def get(self, user_id):
        return {"diet": "vegetarian", "allergens": ["gluten"], "cuisines": [], "cook_time": "any", "budget": "any"}


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    quota, seen = FakeQuota(), []

    def fake_generate(prompt, schema, image_b64=None, mime_type="image/jpeg"):
        seen.append(prompt)
        return ANSWER

    monkeypatch.setattr(ai_router, "generate_json", fake_generate)
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_quota_store] = lambda: quota
    app.dependency_overrides[get_plan_store] = lambda: Plans()
    app.dependency_overrides[get_profile_store] = lambda: Profiles()
    yield TestClient(app), quota, seen
    app.dependency_overrides.clear()


def test_premium_gets_recipe_and_ingredients_and_it_is_charged(env):
    client, quota, seen = env
    r = client.post("/api/ai/dish-recipe", json=BODY)
    assert r.status_code == 200 and r.json() == ANSWER
    assert quota.used == 1
    assert "Сирники" in seen[0] and "без цукру" in seen[0]
    # the profile is respected: diet and allergens go into the prompt
    assert "вегетаріан" in seen[0].lower() and "СУВОРО виключи" in seen[0]


def test_free_plan_is_refused_without_spending_anything(env):
    client, quota, seen = env
    app.dependency_overrides[get_plan_store] = lambda: Plans("free")
    r = client.post("/api/ai/dish-recipe", json=BODY)
    assert r.status_code == 403 and r.json()["detail"] == "premium_required"
    assert seen == [] and quota.used == 0


def test_daily_limit_applies(env):
    client, quota, seen = env
    quota.used = 2
    assert client.post("/api/ai/dish-recipe", json=BODY).status_code == 429
    assert seen == []


def test_failures_are_not_charged(env, monkeypatch):
    client, quota, _ = env

    def busy(*a, **k):
        raise gemini.AIBusy("[m] Gemini returned 503")

    monkeypatch.setattr(ai_router, "generate_json", busy)
    r = client.post("/api/ai/dish-recipe", json=BODY)
    assert r.status_code == 502 and r.json()["detail"] == "AI is busy" and quota.used == 0

    monkeypatch.setattr(ai_router, "generate_json", lambda *a, **k: {"recipe": "x"})
    assert client.post("/api/ai/dish-recipe", json=BODY).status_code == 502
    assert quota.used == 0


def test_input_validation(env):
    client, quota, seen = env
    assert client.post("/api/ai/dish-recipe", json={"name": ""}).status_code == 422
    assert seen == [] and quota.used == 0


def test_prompt_without_profile_still_works():
    text = prompts.dish_recipe_prompt("Плов", None, "")
    assert "Плов" in text and "СУВОРО" not in text


def test_steps_each_go_on_their_own_line(env, monkeypatch):
    client, _, _ = env
    answer = {"recipe": "1. Змішайте сир з яйцем. 2. Додайте борошно (2.5 ст. л.). 3) Обсмажте.", "ingredients": []}
    monkeypatch.setattr(ai_router, "generate_json", lambda *a, **k: answer)
    text = client.post("/api/ai/dish-recipe", json=BODY).json()["recipe"]
    assert text.split("\n") == [
        "1. Змішайте сир з яйцем.",
        "2. Додайте борошно (2.5 ст. л.).",
        "3) Обсмажте.",
    ]


def test_text_without_steps_is_left_alone():
    from app.ai_gateway.schemas import one_step_per_line

    assert one_step_per_line("  Просто змішайте. Додайте 2 яйця.  ") == "Просто змішайте. Додайте 2 яйця."
    assert one_step_per_line("1. Єдиний крок") == "1. Єдиний крок"
    assert one_step_per_line("1. Раз\n2. Два") == "1. Раз\n2. Два"


def test_english_users_get_an_english_answer_request(env):
    client, _, seen = env
    client.post("/api/ai/dish-recipe", json=BODY, headers={"X-Lang": "en"})
    client.post("/api/ai/dish-recipe", json=BODY)
    assert "in English" in seen[0]
    assert "in English" not in seen[1]


def test_cors_allows_the_language_header(env):
    client, _, _ = env
    r = client.options(
        "/api/ai/dish-recipe",
        headers={
            "Origin": "https://mealoria.mealoria.workers.dev",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-lang,authorization",
        },
    )
    assert r.status_code == 200
