import os
import secrets

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


    def create_promo(self, code: str, days: int, max_uses: int | None) -> dict:
        return self._rpc(
            "admin_create_promo", {"new_code": code, "new_days": days, "new_max_uses": max_uses}
        )

    def list_promos(self) -> list[dict]:
        return self._rpc("admin_list_promos")

    def delete_promo(self, code: str) -> dict:
        return self._rpc("admin_delete_promo", {"target_code": code})


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


@router.post("/sentry-test")
def sentry_test(_: str = Depends(current_user_id), store: SupabaseAdminStore = Depends(get_store)):
    """Admin-only: raise an unexpected error on purpose to check that Sentry receives it."""
    _admin_only(store.premium_users)  # refuses (404) anyone who is not an admin
    raise RuntimeError("Sentry test error from the Mealoria backend")


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


class PromoCreate(BaseModel):
    code: str = Field(default="", max_length=40)  # empty = generate one
    days: int = Field(ge=1, le=3650)
    max_uses: int | None = Field(default=1, ge=1, le=100000)  # None = unlimited


# no 0, O, 1, I: a code read from a screen or a message cannot be mistyped
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_code() -> str:
    def chunk() -> str:
        return "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))

    return f"MEAL-{chunk()}-{chunk()}"


@router.get("/promos")
def list_promos(_: str = Depends(current_user_id), store: SupabaseAdminStore = Depends(get_store)):
    return _admin_only(store.list_promos)


@router.post("/promo", status_code=201)
def create_promo(
    body: PromoCreate,
    _: str = Depends(current_user_id),
    store: SupabaseAdminStore = Depends(get_store),
):
    own = body.code.strip()
    for _attempt in range(1 if own else 5):
        code = own or generate_code()
        result = _admin_only(lambda: store.create_promo(code, body.days, body.max_uses))
        if result.get("ok"):
            return result
        if result.get("error") != "exists" or own:
            break  # a generated code that already exists is simply replaced by another one
    error = result.get("error", "failed")
    raise HTTPException(status_code=409 if error == "exists" else 422, detail=error)


@router.delete("/promo/{code}", status_code=204)
def delete_promo(
    code: str,
    _: str = Depends(current_user_id),
    store: SupabaseAdminStore = Depends(get_store),
):
    result = _admin_only(lambda: store.delete_promo(code))
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail="promo_not_found")
