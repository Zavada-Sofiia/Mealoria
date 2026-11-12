import httpx
import pytest
from fastapi.testclient import TestClient

from app.admin.router import NotAdmin, get_store as get_admin_store
from app.auth import current_user_id
from app.main import app
from app.notice import router as notice_router
from app.notice.router import NoticeOut


@pytest.fixture(autouse=True)
def fresh_cache():
    notice_router.forget_cache()
    notice_router._cache["value"] = NoticeOut()
    yield
    notice_router.forget_cache()


@pytest.fixture
def client():
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    yield TestClient(app)
    app.dependency_overrides.clear()


class FakeAdmin:
    def __init__(self, error=None):
        self.error, self.saved = error, None

    def set_notice(self, active, level, uk, en):
        if self.error:
            raise self.error
        self.saved = (active, level, uk, en)
        return {"ok": True}


def test_everyone_can_read_the_notice_without_signing_in(monkeypatch):
    monkeypatch.setattr(
        notice_router, "read_notice",
        lambda: NoticeOut(active=True, level="warning", message_uk="Технічні проблеми", message_en="Technical problems"),
    )
    r = TestClient(app).get("/api/notice")  # no token
    assert r.status_code == 200
    assert r.json() == {"active": True, "level": "warning", "message_uk": "Технічні проблеми", "message_en": "Technical problems"}


def test_the_notice_is_cached_for_a_short_time(monkeypatch):
    calls = []
    monkeypatch.setattr(notice_router, "read_notice", lambda: calls.append(1) or NoticeOut(active=True, message_uk="x"))
    c = TestClient(app)
    c.get("/api/notice"), c.get("/api/notice"), c.get("/api/notice")
    assert len(calls) == 1


def test_a_database_problem_means_no_notice_not_an_error(monkeypatch):
    def broken():
        raise httpx.ConnectError("down")

    monkeypatch.setattr(notice_router, "read_notice", broken)
    r = TestClient(app).get("/api/notice")
    assert r.status_code == 200 and r.json()["active"] is False


def test_admin_switches_the_notice_on(client):
    store = FakeAdmin()
    app.dependency_overrides[get_admin_store] = lambda: store
    r = client.put("/api/admin/notice", json={"active": True, "level": "warning", "message_uk": "Технічні роботи", "message_en": ""})
    assert r.status_code == 200 and store.saved == (True, "warning", "Технічні роботи", "")


def test_an_empty_message_cannot_be_switched_on_but_can_be_switched_off(client):
    app.dependency_overrides[get_admin_store] = lambda: FakeAdmin()
    assert client.put("/api/admin/notice", json={"active": True, "message_uk": "  "}).status_code == 422
    assert client.put("/api/admin/notice", json={"active": False}).status_code == 200


def test_bad_level_and_too_long_text_are_rejected(client):
    app.dependency_overrides[get_admin_store] = lambda: FakeAdmin()
    assert client.put("/api/admin/notice", json={"active": True, "level": "red", "message_uk": "x"}).status_code == 422
    assert client.put("/api/admin/notice", json={"active": True, "message_uk": "x" * 501}).status_code == 422


def test_non_admins_get_a_plain_not_found(client):
    app.dependency_overrides[get_admin_store] = lambda: FakeAdmin(error=NotAdmin())
    r = client.put("/api/admin/notice", json={"active": True, "message_uk": "x"})
    assert r.status_code == 404 and r.json() == {"detail": "Not Found"}
