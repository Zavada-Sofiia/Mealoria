import os

import httpx

FIELDS = (
    "id,name,category,recipe,ingredients,calories,protein_g,fat_g,carbs_g,fiber_g,"
    "diet,allergens,cuisine,cook_minutes,budget,photo_url"
)


class SupabaseRecipeStore:
    """Read-only access to the shared recipe catalog as the signed-in user."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/recipes"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def list(self, query: str = "") -> list[dict]:
        params = [("select", FIELDS), ("order", "category.asc,name.asc")]
        term = query.replace("*", "").replace("%", "").strip()
        if term:
            params.append(("name", f"ilike.*{term}*"))
        r = httpx.get(self.url, params=params, headers=self.headers, timeout=15)
        r.raise_for_status()
        return r.json()

    def get(self, recipe_id: str) -> dict | None:
        r = httpx.get(
            self.url,
            params={"select": FIELDS, "id": f"eq.{recipe_id}"},
            headers=self.headers,
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None
