import pytest
from fastapi.testclient import TestClient

from app import monitoring
from app.admin.router import NotAdmin
from app.admin.router import get_store as get_admin_store
from app.ai_gateway.gemini import AIBusy
from app.auth import current_user_id
from app.main import app


def test_sentry_stays_off_without_a_dsn(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    calls = []
    monkeypatch.setattr(monitoring.sentry_sdk, "init", lambda **kw: calls.append(kw))
    assert monitoring.init_sentry() is False and calls == []


def test_sentry_starts_with_privacy_safe_settings(monkeypatch):
    monkeypatch.setenv("SENTRY_DSN", "https://key@o1.ingest.sentry.io/2")
    calls = []
    monkeypatch.setattr(monitoring.sentry_sdk, "init", lambda **kw: calls.append(kw))
    assert monitoring.init_sentry() is True
    cfg = calls[0]
    assert cfg["send_default_pii"] is False and cfg["max_request_body_size"] == "never"
    assert cfg["traces_sample_rate"] == 0.0 and cfg["environment"] == "production"


def test_expected_busy_errors_are_not_reported():
    busy = {"exc_info": (AIBusy, AIBusy("x"), None)}
    boom = {"exc_info": (RuntimeError, RuntimeError("x"), None)}
    event = {"message": "m"}
    assert monitoring._drop_expected(event, busy) is None
    assert monitoring._drop_expected(event, boom) == event
    assert monitoring._drop_expected(event, {}) == event


class Admin:
    def __init__(self, ok):
        self.ok = ok

    def premium_users(self):
        if not self.ok:
            raise NotAdmin
        return []


@pytest.fixture
def client():
    app.dependency_overrides[current_user_id] = lambda: "u"
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


def test_sentry_test_route_raises_for_admins_only(client):
    app.dependency_overrides[get_admin_store] = lambda: Admin(ok=True)
    assert client.post("/api/admin/sentry-test").status_code == 500
    app.dependency_overrides[get_admin_store] = lambda: Admin(ok=False)
    assert client.post("/api/admin/sentry-test").status_code == 404
