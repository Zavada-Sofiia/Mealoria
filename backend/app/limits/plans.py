import os

import httpx
from fastapi import HTTPException


def _base() -> str:
    return os.environ["SUPABASE_URL"].strip().rstrip("/.") + "/rest/v1/rpc"


class SupabasePlanStore:
    """Reads the signed-in user's plan and limits (my_limits) or the public plan table."""

    def __init__(self, token: str | None = None):
        key = os.environ["SUPABASE_PUBLISHABLE_KEY"]
        self.headers = {"apikey": key, "Authorization": f"Bearer {token or key}"}

    def _rpc(self, name: str, payload: dict | None = None):
        r = httpx.post(f"{_base()}/{name}", headers=self.headers, json=payload or {}, timeout=15)
        r.raise_for_status()
        return r.json()

    def my_limits(self) -> dict:
        return self._rpc("my_limits")

    def plan_table(self) -> dict:
        return self._rpc("plan_table")


def plan_limit_of(error: httpx.HTTPStatusError) -> str | None:
    """The database refuses writes over the plan limits with a message like 'plan_limit:dishes'."""
    try:
        message = error.response.json().get("message", "")
    except ValueError:
        return None
    return message if isinstance(message, str) and message.startswith("plan_limit:") else None


def raise_if_plan_limit(error: httpx.HTTPStatusError) -> None:
    limit = plan_limit_of(error)
    if limit:
        raise HTTPException(status_code=403, detail=limit) from error
