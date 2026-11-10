from fastapi.testclient import TestClient

from app.main import app


def test_me_requires_token():
    assert TestClient(app).get("/api/me").status_code in (401, 403)


def test_me_rejects_garbage_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    r = TestClient(app).get("/api/me", headers={"Authorization": "Bearer abc"})
    assert r.status_code == 401
