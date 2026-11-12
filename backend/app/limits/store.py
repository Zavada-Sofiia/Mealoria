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

    def get(self, user_id: str) -> dict | None:
        r = httpx.get(
            self.url,
            params={"select": "user_id,months", "user_id": f"eq.{user_id}"},
            headers=self.headers,
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def exists(self, user_id: str) -> bool:
        return self.get(user_id) is not None

    def add(self, user_id: str, months: int | None = None) -> None:
        """One pre-order per person; choosing again just changes the period."""
        r = httpx.post(
            self.url,
            params={"on_conflict": "user_id"},
            headers={**self.headers, "Prefer": "resolution=merge-duplicates"},
            json={"user_id": user_id, "months": months},
            timeout=15,
        )
        r.raise_for_status()
