import os
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.auth import bearer, current_user_id

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


class SupabaseFeedbackStore:
    """Calls submit_feedback() as the signed-in user; the database checks the length and the daily limit."""

    def __init__(self, token: str):
        base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.url = f"{base}/rest/v1/rpc/submit_feedback"
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def submit(self, category: str, message: str, page: str) -> dict:
        r = httpx.post(
            self.url,
            headers=self.headers,
            json={"fb_category": category, "fb_message": message, "fb_page": page},
            timeout=20,
        )
        r.raise_for_status()
        return r.json()


def get_store(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> SupabaseFeedbackStore:
    return SupabaseFeedbackStore(creds.credentials)


class FeedbackIn(BaseModel):
    category: Literal["bug", "idea", "question", "other"]
    message: str = Field(min_length=1, max_length=2500)
    page: str = Field(default="", max_length=300)


ERRORS = {
    "too_short": (422, "feedback_too_short"),
    "too_long": (422, "feedback_too_long"),
    "too_many": (429, "feedback_too_many"),
}


@router.post("", status_code=201)
def send_feedback(
    body: FeedbackIn,
    _: str = Depends(current_user_id),
    store: SupabaseFeedbackStore = Depends(get_store),
):
    try:
        result = store.submit(body.category, body.message, body.page)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not send the message, try again")
    if not result.get("ok"):
        status, detail = ERRORS.get(result.get("error", ""), (422, "feedback_invalid"))
        raise HTTPException(status_code=status, detail=detail)
    return {"ok": True}
