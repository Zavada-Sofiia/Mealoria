import httpx
import pytest
from fastapi.testclient import TestClient

from app.admin.router import NotAdmin
from app.admin.router import get_store as get_admin_store
from app.auth import current_user_id
from app.main import app
from app.payments import router as payments
from app.payments.router import extract_code, get_confirm_store, get_store

SECRET = "s" * 40


class FakeStore:
    def __init__(self):
        self.created = []
        self.result = {"ok": True, "code": "ML-7K3Q9X", "months": 3, "amount_uah": 129}

    def prices(self):
        return {1: 49, 3: 129, 6: 239, 12: 449}

    def create_order(self, months):
        self.created.append(months)
        return self.result

    def my_orders(self):
        return [{"code": "ML-7K3Q9X", "status": "pending"}]

    def cancel_order(self, code):
        return {"ok": code == "ML-7K3Q9X"}


class FakeConfirm:
    def __init__(self, result=None, error=None):
        self.calls, self.result, self.error = [], result or {"ok": True, "months": 3}, error

    def confirm(self, code, tx_id, kopecks):
        self.calls.append((code, tx_id, kopecks))
        if self.error:
            raise self.error
        return self.result


def hook(comment="Premium ML-7K3Q9X", amount=12900, tx="tx-1", kind="StatementItem"):
    return {"type": kind, "data": {"account": "acc", "statementItem": {"id": tx, "amount": amount, "comment": comment}}}


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("PAYMENTS_SECRET", SECRET)
    monkeypatch.setenv("PAYMENT_CARD", "5375 4141 0000 0000")
    monkeypatch.delenv("MONOBANK_TOKEN", raising=False)
    confirm, store = FakeConfirm(), FakeStore()
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    app.dependency_overrides[get_store] = lambda: store
    app.dependency_overrides[get_confirm_store] = lambda: confirm
    yield TestClient(app), store, confirm, monkeypatch
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "comment,expected",
    [
        ("ML-7K3Q9X", "ML-7K3Q9X"),
        ("ml 7k3q9x, дякую", "ML-7K3Q9X"),
        ("Оплата Mealoria ML_7K3Q9X", "ML-7K3Q9X"),
        ("МL-7К3Q9X", "ML-7K3Q9X"),  # Cyrillic М and К typed by hand
        ("ML7K3Q9X", "ML-7K3Q9X"),
        ("за каву", None),
        ("ML-123", None),
        ("", None),
    ],
)
def test_the_code_is_found_in_any_comment(comment, expected):
    assert extract_code(comment) == expected


def test_info_shows_the_card_and_the_prices(env):
    client, *_ = env
    data = client.get("/api/payments/info").json()
    assert data == {"enabled": True, "card": "5375 4141 0000 0000", "prices": {"1": 49, "3": 129, "6": 239, "12": 449}}


def test_payments_are_off_until_the_card_and_secret_are_set(env):
    client, store, _, mp = env
    mp.delenv("PAYMENT_CARD")
    assert client.get("/api/payments/info").json()["enabled"] is False
    assert client.post("/api/payments/orders", json={"months": 3}).json() == {"detail": "payments_not_configured"}
    assert store.created == []


def test_an_order_is_created_for_a_known_period_only(env):
    client, store, *_ = env
    r = client.post("/api/payments/orders", json={"months": 3})
    assert r.status_code == 201 and r.json()["code"] == "ML-7K3Q9X" and store.created == [3]
    assert client.post("/api/payments/orders", json={"months": 2}).status_code == 422
    assert client.get("/api/payments/orders").json()[0]["status"] == "pending"
    assert client.delete("/api/payments/orders/ML-7K3Q9X").status_code == 204
    assert client.delete("/api/payments/orders/ML-AAAAAA").status_code == 404


def test_a_payment_with_the_code_is_confirmed(env):
    client, _, confirm, _ = env
    r = client.post(f"/api/payments/monobank/{SECRET}", json=hook())
    assert r.status_code == 200 and r.json()["matched"] is True
    assert confirm.calls == [("ML-7K3Q9X", "tx-1", 12900)]


def test_the_webhook_address_needs_the_secret(env):
    client, _, confirm, _ = env
    assert client.post("/api/payments/monobank/wrong", json=hook()).status_code == 404
    assert client.get("/api/payments/monobank/wrong").status_code == 404
    assert client.get(f"/api/payments/monobank/{SECRET}").status_code == 200  # monobank checks the address
    assert confirm.calls == []


def test_nothing_is_accepted_when_the_secret_is_not_set(env):
    client, _, confirm, mp = env
    mp.delenv("PAYMENTS_SECRET")
    assert client.post("/api/payments/monobank/", json=hook()).status_code in (404, 405)
    assert client.post("/api/payments/monobank/x", json=hook()).status_code == 404
    assert confirm.calls == []


def test_outgoing_payments_other_events_and_missing_codes_are_ignored(env):
    client, _, confirm, _ = env
    url = f"/api/payments/monobank/{SECRET}"
    assert client.post(url, json=hook(amount=-12900)).json()["ignored"] is True
    assert client.post(url, json=hook(kind="Ping")).json()["ignored"] is True
    assert client.post(url, json=hook(comment="за каву")).json()["matched"] is False
    assert client.post(url, json={}).status_code == 200
    assert confirm.calls == []


def test_a_rejected_payment_is_answered_with_200_so_the_bank_stops_retrying(env):
    client, _, confirm, _ = env
    confirm.result = {"ok": False, "error": "amount_too_low"}
    r = client.post(f"/api/payments/monobank/{SECRET}", json=hook(amount=100))
    assert r.status_code == 200 and r.json() == {"ok": True, "matched": False, "error": "amount_too_low"}


def test_a_database_outage_makes_the_bank_try_again(env):
    client, _, _, _ = env
    app.dependency_overrides[get_confirm_store] = lambda: FakeConfirm(error=httpx.ConnectError("down"))
    assert client.post(f"/api/payments/monobank/{SECRET}", json=hook()).status_code == 502
    app.dependency_overrides[get_confirm_store] = lambda: FakeConfirm(error=PermissionError("secret"))
    assert client.post(f"/api/payments/monobank/{SECRET}", json=hook()).status_code == 503


def test_with_a_bank_token_the_payment_is_checked_in_the_statement(env):
    client, _, confirm, mp = env
    mp.setenv("MONOBANK_TOKEN", "tok")
    url = f"/api/payments/monobank/{SECRET}"

    mp.setattr(payments, "find_in_statement", lambda account, tx: None)  # a forged webhook
    assert client.post(url, json=hook()).json() == {"ok": True, "verified": False}
    assert confirm.calls == []

    # the bank's own amount and comment count, not the ones in the webhook
    mp.setattr(payments, "find_in_statement", lambda account, tx: {"id": tx, "amount": 4900, "comment": "ML-AAAAAA"})
    client.post(url, json=hook(comment="ML-7K3Q9X", amount=999999))
    assert confirm.calls == [("ML-AAAAAA", "tx-1", 4900)]


def test_bank_rate_limit_and_outage_make_the_bank_try_again(env):
    client, _, confirm, mp = env
    mp.setenv("MONOBANK_TOKEN", "tok")

    def limited(*a):
        raise payments.RateLimited

    mp.setattr(payments, "find_in_statement", limited)
    assert client.post(f"/api/payments/monobank/{SECRET}", json=hook()).status_code == 503

    def down(*a):
        raise httpx.ConnectError("down")

    mp.setattr(payments, "find_in_statement", down)
    assert client.post(f"/api/payments/monobank/{SECRET}", json=hook()).status_code == 502
    assert confirm.calls == []


class AdminFake:
    def __init__(self, error=None):
        self.error, self.secret, self.confirmed = error, None, []

    def _guard(self):
        if self.error:
            raise self.error

    def set_payment_secret(self, secret):
        self._guard()
        self.secret = secret
        return {"ok": True}

    def payment_status(self):
        self._guard()
        return {"secret_set": True, "pending": 1, "paid": 2, "paid_uah": 178}

    def payment_orders(self):
        self._guard()
        return [{"code": "ML-7K3Q9X", "status": "pending"}]

    def payment_secret_matches(self, secret):
        return secret == self.secret

    def confirm_order(self, code, note):
        self._guard()
        self.confirmed.append((code, note))
        return {"ok": code == "ML-7K3Q9X"}


def test_admin_sets_the_secret_and_sees_whether_everything_matches(env):
    client, *_ = env
    store = AdminFake()
    app.dependency_overrides[get_admin_store] = lambda: store
    assert client.put("/api/admin/payments/secret", json={"secret": SECRET}).status_code == 200
    status = client.get("/api/admin/payments").json()
    assert status["paid_uah"] == 178 and status["card_set"] and status["secret_in_environment"]
    assert status["secret_matches"] is True and status["bank_check"] is False and len(status["orders"]) == 1
    store.secret = "other" * 10
    assert client.get("/api/admin/payments").json()["secret_matches"] is False
    assert client.put("/api/admin/payments/secret", json={"secret": "short"}).status_code == 422


def test_admin_confirms_an_order_by_hand(env):
    client, *_ = env
    store = AdminFake()
    app.dependency_overrides[get_admin_store] = lambda: store
    assert client.post("/api/admin/payments/orders/ML-7K3Q9X/confirm", json={"note": "no comment"}).status_code == 200
    assert client.post("/api/admin/payments/orders/ML-NOPE00/confirm", json={}).status_code == 404
    assert store.confirmed[0] == ("ML-7K3Q9X", "no comment")


def test_non_admins_cannot_touch_payments(env):
    client, *_ = env
    app.dependency_overrides[get_admin_store] = lambda: AdminFake(error=NotAdmin())
    assert client.get("/api/admin/payments").status_code == 404
    assert client.put("/api/admin/payments/secret", json={"secret": SECRET}).status_code == 404
    assert client.post("/api/admin/payments/orders/ML-7K3Q9X/confirm", json={}).status_code == 404
