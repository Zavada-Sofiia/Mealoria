import os
import secrets
from uuid import UUID

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

    def grant_premium(self, email: str, months: int, days: int, unlimited: bool) -> dict:
        return self._rpc(
            "admin_grant_premium",
            {"target_email": email, "add_months": months, "add_days": days, "make_unlimited": unlimited},
        )

    def premium_history(self) -> list[dict]:
        return self._rpc("admin_premium_history", {"max_rows": 100})

    def preorders_by_period(self) -> list[dict]:
        return self._rpc("admin_preorders_by_period")

    def payment_status(self) -> dict:
        return self._rpc("admin_payment_status")

    def payment_orders(self) -> list[dict]:
        return self._rpc("admin_payment_orders")

    def set_payment_secret(self, secret: str) -> dict:
        return self._rpc("admin_set_payment_secret", {"new_secret": secret})

    def payment_secret_matches(self, secret: str) -> bool:
        return bool(self._rpc("admin_check_payment_secret", {"candidate": secret}))

    def confirm_order(self, code: str, note: str) -> dict:
        return self._rpc("admin_confirm_order", {"order_code": code, "admin_note": note})

    def feedback_list(self) -> dict:
        return self._rpc("admin_feedback_list")

    def set_feedback_status(self, feedback_id: str, status: str) -> dict:
        return self._rpc("admin_set_feedback_status", {"fb_id": feedback_id, "new_status": status})

    def set_notice(self, active: bool, level: str, message_uk: str, message_en: str) -> dict:
        return self._rpc(
            "admin_set_notice",
            {"new_active": active, "new_level": level, "new_uk": message_uk, "new_en": message_en},
        )

    def delete_promo(self, code: str) -> dict:
        return self._rpc("admin_delete_promo", {"target_code": code})

    def set_promo_message(self, code: str, message_uk: str, message_en: str) -> dict:
        return self._rpc(
            "admin_set_promo_message", {"target_code": code, "new_uk": message_uk, "new_en": message_en}
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
    # shown to the person who redeems this code, instead of the standard "Premium activated"
    message_uk: str = Field(default="", max_length=1000)
    message_en: str = Field(default="", max_length=1000)


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
            if body.message_uk.strip() or body.message_en.strip():
                _admin_only(lambda: store.set_promo_message(result["code"], body.message_uk, body.message_en))
            return {**result, "message_uk": body.message_uk.strip() or None, "message_en": body.message_en.strip() or None}
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


class PromoMessageIn(BaseModel):
    message_uk: str = Field(default="", max_length=1000)
    message_en: str = Field(default="", max_length=1000)


@router.put("/promo/{code}/message")
def set_promo_message(
    code: str,
    body: PromoMessageIn,
    _: str = Depends(current_user_id),
    store: SupabaseAdminStore = Depends(get_store),
):
    """Admin-only: the text shown after this code is redeemed; empty texts remove it."""
    result = _admin_only(lambda: store.set_promo_message(code, body.message_uk, body.message_en))
    if not result.get("ok"):
        error = result.get("error", "failed")
        raise HTTPException(status_code=404 if error == "not_found" else 422, detail=error)
    return result


class NoticeIn(BaseModel):
    active: bool
    level: str = Field(default="info", pattern="^(info|warning)$")
    message_uk: str = Field(default="", max_length=500)
    message_en: str = Field(default="", max_length=500)


@router.put("/notice")
def set_notice(
    body: NoticeIn,
    _: str = Depends(current_user_id),
    store: SupabaseAdminStore = Depends(get_store),
):
    """Admin-only: switch the message for the whole site on or off and change its text."""
    if body.active and not (body.message_uk.strip() or body.message_en.strip()):
        raise HTTPException(status_code=422, detail="message_required")
    result = _admin_only(
        lambda: store.set_notice(body.active, body.level, body.message_uk, body.message_en)
    )
    if not result.get("ok"):
        raise HTTPException(status_code=422, detail=result.get("error", "failed"))
    from app.notice.router import forget_cache

    forget_cache()  # the change shows up at once, not after the cache runs out
    return result


class PremiumGrant(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    months: int = Field(default=0, ge=0, le=120)
    days: int = Field(default=0, ge=0, le=3650)
    unlimited: bool = False


@router.post("/premium/grant")
def grant_premium(
    body: PremiumGrant,
    _: str = Depends(current_user_id),
    store: SupabaseAdminStore = Depends(get_store),
):
    """Admin-only: add a period (months and/or days) to a user's Premium; the end date is extended, never replaced."""
    result = _admin_only(
        lambda: store.grant_premium(body.email.strip(), body.months, body.days, body.unlimited)
    )
    if not result.get("ok"):
        raise HTTPException(status_code=422, detail=result.get("error", "failed"))
    return result


@router.get("/premium/history")
def premium_history(_: str = Depends(current_user_id), store: SupabaseAdminStore = Depends(get_store)):
    return _admin_only(store.premium_history)


@router.get("/preorders")
def preorders_by_period(_: str = Depends(current_user_id), store: SupabaseAdminStore = Depends(get_store)):
    return _admin_only(store.preorders_by_period)


class PaymentSecretIn(BaseModel):
    secret: str = Field(min_length=32, max_length=200)


@router.put("/payments/secret")
def set_payment_secret(
    body: PaymentSecretIn,
    _: str = Depends(current_user_id),
    store: SupabaseAdminStore = Depends(get_store),
):
    """Admin-only: store the hash of the secret that the backend (PAYMENTS_SECRET) must use."""
    result = _admin_only(lambda: store.set_payment_secret(body.secret))
    if not result.get("ok"):
        raise HTTPException(status_code=422, detail=result.get("error", "failed"))
    return {"ok": True}


@router.get("/payments")
def payments_status(_: str = Depends(current_user_id), store: SupabaseAdminStore = Depends(get_store)):
    """Admin-only: the set-up state, whether the backend's secret matches the database, and the orders."""
    from app.payments.router import card_number, shared_secret

    secret = shared_secret()
    return {
        **_admin_only(store.payment_status),
        "card_set": bool(card_number()),
        "secret_in_environment": bool(secret),
        "secret_matches": bool(secret) and _admin_only(lambda: store.payment_secret_matches(secret)),
        "bank_check": bool(os.environ.get("MONOBANK_TOKEN")),
        "orders": _admin_only(store.payment_orders),
    }


class OrderConfirm(BaseModel):
    note: str = Field(default="", max_length=200)


@router.post("/payments/orders/{code}/confirm")
def confirm_order(
    code: str,
    body: OrderConfirm,
    _: str = Depends(current_user_id),
    store: SupabaseAdminStore = Depends(get_store),
):
    """Admin-only: the money arrived but the order was not matched by itself; add the Premium by hand."""
    result = _admin_only(lambda: store.confirm_order(code, body.note))
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail="Not Found")
    return result


@router.get("/feedback")
def feedback_list(_: str = Depends(current_user_id), store: SupabaseAdminStore = Depends(get_store)):
    return _admin_only(store.feedback_list)


class FeedbackStatus(BaseModel):
    status: str = Field(pattern="^(new|done)$")


@router.put("/feedback/{feedback_id}")
def set_feedback_status(
    feedback_id: UUID,
    body: FeedbackStatus,
    _: str = Depends(current_user_id),
    store: SupabaseAdminStore = Depends(get_store),
):
    result = _admin_only(lambda: store.set_feedback_status(str(feedback_id), body.status))
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail="Not Found")
    return result
