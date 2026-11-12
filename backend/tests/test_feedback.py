import httpx
import pytest
from fastapi.testclient import TestClient

from app.admin.router import NotAdmin
from app.admin.router import get_store as get_admin_store
from app.auth import current_user_id
from app.feedback.router import get_store
from app.main import app

ID = "6f1c2d3e-0000-4000-8000-000000000001"


class FakeStore:
    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result or {"ok": True}, error, []

    def submit(self, category, message, page):
        self.calls.append((category, message, page))
        if self.error:
            raise self.error
        return self.result


@pytest.fixture
def client():
    app.dependency_overrides[current_user_id] = lambda: "user-1"
    yield TestClient(app)
    app.dependency_overrides.clear()


def use(store):
    app.dependency_overrides[get_store] = lambda: store
    return store


def post(client, **over):
    body = {"category": "bug", "message": "The calendar does not open", "page": "/calendar", **over}
    return client.post("/api/feedback", json=body)


def test_a_message_is_passed_to_the_database(client):
    store = use(FakeStore())
    r = post(client)
    assert r.status_code == 201 and r.json() == {"ok": True}
    assert store.calls == [("bug", "The calendar does not open", "/calendar")]


@pytest.mark.parametrize(
    "error,status,detail",
    [("too_short", 422, "feedback_too_short"), ("too_long", 422, "feedback_too_long"),
     ("too_many", 429, "feedback_too_many"), ("weird", 422, "feedback_invalid")],
)
def test_the_databases_refusals_become_clear_errors(client, error, status, detail):
    use(FakeStore(result={"ok": False, "error": error}))
    r = post(client)
    assert r.status_code == status and r.json() == {"detail": detail}


def test_bad_input_never_reaches_the_database(client):
    store = use(FakeStore())
    assert post(client, category="spam").status_code == 422
    assert post(client, message="").status_code == 422
    assert post(client, message="x" * 2501).status_code == 422
    assert post(client, page="p" * 301).status_code == 422
    assert store.calls == []


def test_an_outage_is_a_502(client):
    use(FakeStore(error=httpx.ConnectError("down")))
    assert post(client).status_code == 502


def test_anonymous_users_cannot_send():
    app.dependency_overrides.clear()
    assert TestClient(app).post("/api/feedback", json={"category": "bug", "message": "Hello there, friend"}).status_code in (401, 403)


class AdminFake:
    def __init__(self, error=None):
        self.error, self.set = error, []

    def feedback_list(self):
        if self.error:
            raise self.error
        return {"new_count": 1, "items": [{"id": ID, "email": "a@x.ua", "message": "Hi there, team", "status": "new"}]}

    def set_feedback_status(self, feedback_id, status):
        if self.error:
            raise self.error
        self.set.append((feedback_id, status))
        return {"ok": feedback_id == ID}


def test_admin_reads_and_marks_messages(client):
    store = AdminFake()
    app.dependency_overrides[get_admin_store] = lambda: store
    assert client.get("/api/admin/feedback").json()["new_count"] == 1
    assert client.put(f"/api/admin/feedback/{ID}", json={"status": "done"}).status_code == 200
    assert store.set == [(ID, "done")]
    assert client.put("/api/admin/feedback/6f1c2d3e-0000-4000-8000-000000000002", json={"status": "done"}).status_code == 404
    assert client.put(f"/api/admin/feedback/{ID}", json={"status": "weird"}).status_code == 422
    assert client.put("/api/admin/feedback/not-a-uuid", json={"status": "done"}).status_code == 422


def test_non_admins_cannot_read_or_change(client):
    app.dependency_overrides[get_admin_store] = lambda: AdminFake(error=NotAdmin())
    assert client.get("/api/admin/feedback").status_code == 404
    assert client.put(f"/api/admin/feedback/{ID}", json={"status": "done"}).status_code == 404
