import datetime as dt
import os

import httpx

DISH = "dish:dishes(id,name,calories,protein_g,fat_g,carbs_g)"
FIELDS = f"id,date,slot,{DISH}"


class SupabaseCalendarStore:
    """Talks to Supabase PostgREST as the signed-in user, so RLS applies."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/meal_plan"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def list(self, start: dt.date, end: dt.date) -> list[dict]:
        r = httpx.get(
            self.url,
            params=[
                ("select", FIELDS),
                ("date", f"gte.{start}"),
                ("date", f"lt.{end}"),
                ("order", "date.asc,slot.asc,created_at.asc"),
            ],
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

    def move(self, entry_id: str, data: dict) -> dict | None:
        r = httpx.patch(
            self.url,
            params={"id": f"eq.{entry_id}", "select": FIELDS},
            headers={**self.headers, "Prefer": "return=representation"},
            json=data,
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def delete(self, entry_id: str) -> bool:
        r = httpx.delete(
            self.url,
            params={"id": f"eq.{entry_id}", "select": "id"},
            headers={**self.headers, "Prefer": "return=representation"},
            timeout=15,
        )
        r.raise_for_status()
        return bool(r.json())
