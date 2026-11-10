import os

import httpx

FIELDS = (
    "sex,age,height_cm,weight_kg,activity,goal,meals_per_day,"
    "target_calories,diet,allergens,cuisines,cook_time,budget,preferences,allergies"
)


class SupabaseProfileStore:
    """Talks to Supabase PostgREST as the signed-in user, so RLS applies."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/profiles"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def get(self, user_id: str) -> dict | None:
        r = httpx.get(
            self.url,
            params={"select": FIELDS, "user_id": f"eq.{user_id}"},
            headers=self.headers,
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def save(self, user_id: str, data: dict) -> None:
        r = httpx.post(
            self.url,
            params={"on_conflict": "user_id"},
            headers={**self.headers, "Prefer": "resolution=merge-duplicates"},
            json={**data, "user_id": user_id, "updated_at": "now()"},
            timeout=15,
        )
        r.raise_for_status()
