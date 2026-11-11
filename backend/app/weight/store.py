import datetime as dt
import os

import httpx


class SupabaseWeightStore:
    """Talks to Supabase PostgREST as the signed-in user, so RLS applies."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/weight_log"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def list(self, since: dt.date) -> list[dict]:
        r = httpx.get(
            self.url,
            params={"select": "day,weight_kg", "day": f"gte.{since}", "order": "day.asc"},
            headers=self.headers,
            timeout=15,
        )
        r.raise_for_status()
        return r.json()

    def upsert(self, user_id: str, day: dt.date, weight_kg: float) -> dict:
        r = httpx.post(
            self.url,
            params={"on_conflict": "user_id,day", "select": "day,weight_kg"},
            headers={**self.headers, "Prefer": "resolution=merge-duplicates,return=representation"},
            json={"user_id": user_id, "day": day.isoformat(), "weight_kg": weight_kg},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()[0]

    def delete(self, day: dt.date) -> bool:
        r = httpx.delete(
            self.url,
            params={"day": f"eq.{day}", "select": "day"},
            headers={**self.headers, "Prefer": "return=representation"},
            timeout=15,
        )
        r.raise_for_status()
        return bool(r.json())
