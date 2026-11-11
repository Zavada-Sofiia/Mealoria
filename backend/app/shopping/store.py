import datetime as dt
import os

import httpx


class SupabaseShoppingStore:
    """Talks to Supabase PostgREST as the signed-in user, so RLS applies."""

    def __init__(self, token: str):
        self.base = os.environ["SUPABASE_URL"].strip().rstrip("/.") + "/rest/v1"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def _get(self, table: str, params) -> list[dict]:
        r = httpx.get(f"{self.base}/{table}", params=params, headers=self.headers, timeout=15)
        r.raise_for_status()
        return r.json()

    def plan(self, start: dt.date, end: dt.date) -> list[dict]:
        return self._get(
            "meal_plan",
            [
                ("select", "dish:dishes(name,ingredients,servings)"),
                ("date", f"gte.{start}"),
                ("date", f"lt.{end}"),
            ],
        )

    def pantry(self) -> list[dict]:
        return self._get("pantry", {"select": "id,name", "order": "name.asc"})

    def pantry_add(self, user_id: str, name: str) -> None:
        r = httpx.post(
            f"{self.base}/pantry",
            params={"on_conflict": "user_id,name"},
            headers={**self.headers, "Prefer": "resolution=ignore-duplicates"},
            json={"user_id": user_id, "name": name},
            timeout=15,
        )
        r.raise_for_status()

    def pantry_add_many(self, user_id: str, names: list[str]) -> None:
        r = httpx.post(
            f"{self.base}/pantry",
            params={"on_conflict": "user_id,name"},
            headers={**self.headers, "Prefer": "resolution=ignore-duplicates"},
            json=[{"user_id": user_id, "name": n} for n in names],
            timeout=15,
        )
        r.raise_for_status()

    def pantry_delete(self, item_id: str) -> None:
        r = httpx.delete(
            f"{self.base}/pantry", params={"id": f"eq.{item_id}"}, headers=self.headers, timeout=15
        )
        r.raise_for_status()

    def checks(self, start: dt.date) -> list[str]:
        rows = self._get("shopping_checks", {"select": "name", "week_start": f"eq.{start}"})
        return [r["name"] for r in rows]

    def set_check(self, user_id: str, start: dt.date, name: str, checked: bool) -> None:
        if checked:
            r = httpx.post(
                f"{self.base}/shopping_checks",
                params={"on_conflict": "user_id,week_start,name"},
                headers={**self.headers, "Prefer": "resolution=ignore-duplicates"},
                json={"user_id": user_id, "week_start": str(start), "name": name},
                timeout=15,
            )
        else:
            r = httpx.delete(
                f"{self.base}/shopping_checks",
                params={"week_start": f"eq.{start}", "name": f"eq.{name}"},
                headers=self.headers,
                timeout=15,
            )
        r.raise_for_status()
