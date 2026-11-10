import os

import httpx

FIELDS = "id,name,recipe,ingredients,calories,protein_g,fat_g,carbs_g,photo_url"


class SupabaseDishStore:
    """Talks to Supabase PostgREST as the signed-in user, so RLS applies."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/dishes"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def list(self) -> list[dict]:
        r = httpx.get(
            self.url,
            params={"select": FIELDS, "order": "created_at.desc"},
            headers=self.headers,
            timeout=15,
        )
        r.raise_for_status()
        return r.json()

    def create(self, user_id: str, data: dict) -> dict:
        r = httpx.post(
            self.url,
            params={"select": FIELDS},
            headers={**self.headers, "Prefer": "return=representation"},
            json={**data, "user_id": user_id},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()[0]

    def update(self, dish_id: str, data: dict) -> dict | None:
        r = httpx.patch(
            self.url,
            params={"id": f"eq.{dish_id}", "select": FIELDS},
            headers={**self.headers, "Prefer": "return=representation"},
            json=data,
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def delete(self, dish_id: str) -> bool:
        r = httpx.delete(
            self.url,
            params={"id": f"eq.{dish_id}", "select": "id"},
            headers={**self.headers, "Prefer": "return=representation"},
            timeout=15,
        )
        r.raise_for_status()
        return bool(r.json())
