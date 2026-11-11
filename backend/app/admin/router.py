import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.auth import bearer, current_user_id

router = APIRouter(prefix="/api/admin", tags=["admin"])


class NotAdmin(Exception):
    pass


class SupabaseAdminStore:
    """Calls admin_stats(), which only answers for users listed in public.admins."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/rpc/admin_stats"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def _rpc(self, name: str, payload: dict | None = None):
        url = self.url.rsplit("/", 1)[0] + "/" + name
        r = httpx.post(url, headers=self.headers, json=payload or {}, timeout=30)
        if r.status_code in (401, 403):
            raise NotAdmin
        r.raise_for_status()
        return r.json()

    def stats(self) -> dict:
        return self._rpc("admin_stats")

    def premium_users(self) -> list[dict]:
        return self._rpc("admin_premium_users")

    def set_plan(self, email: str, plan: str, days: int | None) -> dict:
        return self._rpc(
            "admin_set_plan", {"target_email": email, "new_plan": plan, "days": days}
        )


def get_store(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> SupabaseAdminStore:
    return SupabaseAdminStore(creds.credentials)


@router.get("/stats")
def stats(_: str = Depends(current_user_id), store: SupabaseAdminStore = Depends(get_store)):
    try:
        return store.stats()
    except NotAdmin:
        # 404, not 403: outsiders must not learn that this page exists
        raise HTTPException(status_code=404, detail="Not Found")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not load statistics")


class PlanChange(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    plan: str = Field(pattern="^(free|premium)$")
    days: int | None = Field(default=None, ge=1, le=3650)  # None = no expiry


def _admin_only(call):
    try:
        return call()
    except NotAdmin:
        raise HTTPException(status_code=404, detail="Not Found")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Request failed")


@router.get("/premium")
def premium_users(_: str = Depends(current_user_id), store: SupabaseAdminStore = Depends(get_store)):
    return _admin_only(store.premium_users)


@router.post("/plan")
def set_plan(
    body: PlanChange,
    _: str = Depends(current_user_id),
    store: SupabaseAdminStore = Depends(get_store),
):
    result = _admin_only(lambda: store.set_plan(body.email.strip(), body.plan, body.days))
    if not result.get("ok"):
        raise HTTPException(status_code=422, detail=result.get("error", "failed"))
    return result
