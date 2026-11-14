import httpx
import pytest
from fastapi.testclient import TestClient

from app.admin import router as admin_router
from app.admin.router import NotAdmin, generate_code
from app.admin.router import get_store as get_admin_store
from app.auth import current_user_id
from app.main import app
from app.promo.router import get_store as get_promo_store


class FakeAdmin:
    def __init__(self, error=None, taken=()):
        self.error, self.taken, self.rows = error, set(taken), {}

    def create_promo(self, code, days, max_uses):
        if self.error:
            raise self.error
        code = code.upper()
        if code in self.taken or code in self.rows:
            return {"ok": False, "error": "exists"}
        self.rows[code] = {"code": code, "days": days, "max_uses": max_uses, "used_count": 0}
        return {"ok": True, "code": code, "days": days, "max_uses": max_uses}

    def list_promos(self):
        if self.error:
            raise self.error
        return list(self.rows.values())

    def delete_promo(self, code):
        return {"ok": self.rows.pop(code.upper(), None) is not None}

    def set_promo_message(self, code, message_uk, message_en):
        row = self.rows.get(code.upper())
        if row is None:
            return {"ok": False, "error": "not_found"}
        row.update(message_uk=message_uk.strip() or None, message_en=message_en.strip() or None)
        return {"ok": True, "code": code.upper()}


class FakePromo:
    def __init__(self, result):
        self.result, self.seen = result, []

    def redeem(self, code):
        self.seen.append(code)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


@pytest.fixture
def client():
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_admin_creates_a_code_with_days_and_uses(client):
    store = FakeAdmin()
    app.dependency_overrides[get_admin_store] = lambda: store
    r = client.post("/api/admin/promo", json={"code": "friends30", "days": 30, "max_uses": 5})
    assert r.status_code == 201 and r.json()["code"] == "FRIENDS30" and r.json()["days"] == 30
    assert client.get("/api/admin/promos").json()[0]["max_uses"] == 5
    assert client.delete("/api/admin/promo/friends30").status_code == 204
    assert client.delete("/api/admin/promo/friends30").status_code == 404


def test_an_empty_code_is_generated_and_a_clash_is_retried(client, monkeypatch):
    store = FakeAdmin(taken={"MEAL-AAAA-AAAA"})
    app.dependency_overrides[get_admin_store] = lambda: store
    codes = iter(["MEAL-AAAA-AAAA", "MEAL-BBBB-BBBB"])
    monkeypatch.setattr(admin_router, "generate_code", lambda: next(codes))
    r = client.post("/api/admin/promo", json={"days": 7})
    assert r.status_code == 201 and r.json()["code"] == "MEAL-BBBB-BBBB"
    assert r.json()["max_uses"] == 1  # one use by default


def test_own_code_that_exists_is_a_conflict_and_input_is_validated(client):
    app.dependency_overrides[get_admin_store] = lambda: FakeAdmin(taken={"SPRING"})
    assert client.post("/api/admin/promo", json={"code": "spring", "days": 5}).status_code == 409
    assert client.post("/api/admin/promo", json={"days": 0}).status_code == 422
    assert client.post("/api/admin/promo", json={"days": 4000}).status_code == 422


def test_non_admins_get_a_plain_not_found(client):
    app.dependency_overrides[get_admin_store] = lambda: FakeAdmin(error=NotAdmin())
    assert client.get("/api/admin/promos").status_code == 404
    assert client.post("/api/admin/promo", json={"days": 5}).status_code == 404


def test_generated_codes_have_no_confusing_characters():
    for _ in range(50):
        code = generate_code()
        assert code.startswith("MEAL-") and len(code) == 14
        assert not set("0O1I") & set(code.replace("MEAL-", "").replace("-", ""))


def test_user_redeems_a_code(client):
    store = FakePromo({"ok": True, "days": 30, "premium_until": "2026-12-12T10:00:00Z", "unlimited": False})
    app.dependency_overrides[get_promo_store] = lambda: store
    r = client.post("/api/promo/redeem", json={"code": "  friends30 "})
    assert r.status_code == 200 and r.json() == {
        "days": 30,
        "premium_until": "2026-12-12T10:00:00Z",
        "unlimited": False,
        "message_uk": None,
        "message_en": None,
    }
    assert store.seen == ["friends30"]


@pytest.mark.parametrize(
    "error,status,detail",
    [
        ("not_found", 404, "promo_not_found"),
        ("already_used", 409, "promo_already_used"),
        ("used_up", 410, "promo_used_up"),
        ("too_many", 429, "promo_too_many"),
    ],
)
def test_redeem_errors_are_clear(client, error, status, detail):
    app.dependency_overrides[get_promo_store] = lambda: FakePromo({"ok": False, "error": error})
    r = client.post("/api/promo/redeem", json={"code": "X1"})
    assert r.status_code == status and r.json()["detail"] == detail


def test_database_problem_is_502_and_empty_code_is_rejected(client):
    app.dependency_overrides[get_promo_store] = lambda: FakePromo(httpx.ConnectError("down"))
    assert client.post("/api/promo/redeem", json={"code": "ABC"}).status_code == 502
    assert client.post("/api/promo/redeem", json={"code": ""}).status_code == 422


def test_a_code_can_carry_its_own_message(client):
    store = FakeAdmin()
    app.dependency_overrides[get_admin_store] = lambda: store
    r = client.post(
        "/api/admin/promo",
        json={"code": "feedback7", "days": 7, "max_uses": 50, "message_uk": " Дякуємо за відповіді! ", "message_en": ""},
    )
    assert r.status_code == 201 and r.json()["message_uk"] == "Дякуємо за відповіді!" and r.json()["message_en"] is None
    assert store.rows["FEEDBACK7"]["message_uk"] == "Дякуємо за відповіді!"

    r = client.put("/api/admin/promo/feedback7/message", json={"message_uk": "Нове", "message_en": "New"})
    assert r.status_code == 200
    assert store.rows["FEEDBACK7"]["message_en"] == "New"
    assert client.put("/api/admin/promo/nope/message", json={"message_uk": "x"}).status_code == 404
    assert client.put("/api/admin/promo/feedback7/message", json={"message_uk": "a" * 1001}).status_code == 422


def test_redeeming_returns_the_codes_message(client):
    store = FakePromo({"ok": True, "days": 7, "premium_until": None, "message_uk": "Дякуємо!", "message_en": "Thanks!"})
    app.dependency_overrides[get_promo_store] = lambda: store
    r = client.post("/api/promo/redeem", json={"code": "FEEDBACK7"})
    assert r.json()["message_uk"] == "Дякуємо!" and r.json()["message_en"] == "Thanks!"


def test_a_code_is_created_even_if_its_message_cannot_be_saved(client):
    store = FakeAdmin()

    def broken(*_):
        raise httpx.HTTPStatusError("no such function", request=None, response=None)

    store.set_promo_message = broken
    app.dependency_overrides[get_admin_store] = lambda: store
    r = client.post("/api/admin/promo", json={"code": "feedback7", "days": 7, "message_uk": "Дякуємо!"})
    assert r.status_code == 201 and r.json()["code"] == "FEEDBACK7" and r.json()["message_saved"] is False
