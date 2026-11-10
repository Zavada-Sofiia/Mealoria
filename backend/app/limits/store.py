import os

import httpx


class SupabasePreorderStore:
    """Talks to Supabase PostgREST as the signed-in user, so RLS applies."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/preorders"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def exists(self, user_id: str) -> bool:
        r = httpx.get(
            self.url,
            params={"select": "user_id", "user_id": f"eq.{user_id}"},
            headers=self.headers,
            timeout=15,
        )
        r.raise_for_status()
        return bool(r.json())

    def add(self, user_id: str) -> None:
        r = httpx.post(
            self.url,
            params={"on_conflict": "user_id"},
            headers={**self.headers, "Prefer": "resolution=ignore-duplicates"},
            json={"user_id": user_id},
            timeout=15,
        )
        r.raise_for_status()
