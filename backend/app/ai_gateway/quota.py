import os

import httpx


class SupabaseQuotaStore:
    """Calls the ai_quota() SQL function as the signed-in user."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/rpc/ai_quota"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def _call(self, limit: int, consume: bool) -> dict:
        r = httpx.post(
            self.url,
            headers=self.headers,
            json={"daily_limit": limit, "consume": consume},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()

    def is_admin(self) -> bool:
        try:
            r = httpx.post(
                self.url.replace("ai_quota", "is_admin"), headers=self.headers, json={}, timeout=15
            )
            return r.status_code == 200 and r.json() is True
        except (httpx.HTTPError, ValueError):
            return False

    def status(self, limit: int) -> dict:
        return self._call(limit, consume=False)

    def consume(self, limit: int) -> dict:
        return self._call(limit, consume=True)
