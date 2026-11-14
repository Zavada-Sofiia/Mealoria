import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.auth import bearer, current_user_id

router = APIRouter(prefix="/api/promo", tags=["promo"])


class SupabasePromoStore:
    """Calls redeem_promo() as the signed-in user; the database does all the checks."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/rpc/redeem_promo"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def redeem(self, code: str) -> dict:
        r = httpx.post(self.url, headers=self.headers, json={"input_code": code}, timeout=20)
        r.raise_for_status()
        return r.json()


def get_store(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> SupabasePromoStore:
    return SupabasePromoStore(creds.credentials)


class RedeemIn(BaseModel):
    code: str = Field(min_length=1, max_length=40)


class RedeemOut(BaseModel):
    days: int
    premium_until: str | None
    unlimited: bool = False
    # the admin's own text for this code (for example a thank-you), if there is one
    message_uk: str | None = None
    message_en: str | None = None


ERRORS = {
    "not_found": (404, "promo_not_found"),
    "already_used": (409, "promo_already_used"),
    "used_up": (410, "promo_used_up"),
    "too_many": (429, "promo_too_many"),
}


@router.post("/redeem", response_model=RedeemOut)
def redeem(
    body: RedeemIn,
    _: str = Depends(current_user_id),
    store: SupabasePromoStore = Depends(get_store),
):
    try:
        result = store.redeem(body.code.strip())
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not apply the promo code, try again")
    if not result.get("ok"):
        status, detail = ERRORS.get(result.get("error", ""), (422, "promo_invalid"))
        raise HTTPException(status_code=status, detail=detail)
    return RedeemOut(
        days=result["days"],
        premium_until=result.get("premium_until"),
        unlimited=bool(result.get("unlimited")),
        message_uk=result.get("message_uk"),
        message_en=result.get("message_en"),
    )
