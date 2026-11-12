import datetime as dt
import os

import httpx


class SupabaseWaterStore:
    """Talks to Supabase PostgREST as the signed-in user, so RLS applies."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/water_log"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def for_day(self, day: dt.date) -> list[dict]:
        r = httpx.get(
            self.url,
            params={"select": "id,amount_ml,created_at", "day": f"eq.{day}", "order": "created_at.asc"},
            headers=self.headers,
            timeout=15,
        )
        r.raise_for_status()
        return r.json()

    def add(self, user_id: str, day: dt.date, amount_ml: int) -> dict:
        r = httpx.post(
            self.url,
            params={"select": "id,amount_ml,created_at"},
            headers={**self.headers, "Prefer": "return=representation"},
            json={"user_id": user_id, "day": day.isoformat(), "amount_ml": amount_ml},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()[0]

    def delete(self, entry_id: str) -> bool:
        r = httpx.delete(
            self.url,
            params={"id": f"eq.{entry_id}", "select": "id"},
            headers={**self.headers, "Prefer": "return=representation"},
            timeout=15,
        )
        r.raise_for_status()
        return bool(r.json())
