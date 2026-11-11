import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import bearer, current_user_id

router = APIRouter(prefix="/api/account", tags=["account"])

BUCKET = "dish-photos"


class SupabaseAccountStore:
    """Removes the signed-in user's photos and then the account itself, always as that user."""

    def __init__(self, token: str):
        self.base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
        self.headers = {
            "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": f"Bearer {token}",
        }

    def delete_photos(self, user_id: str) -> None:
        r = httpx.post(
            f"{self.base}/storage/v1/object/list/{BUCKET}",
            headers=self.headers,
            json={"prefix": user_id, "limit": 1000},
            timeout=20,
        )
        r.raise_for_status()
        paths = [f"{user_id}/{o['name']}" for o in r.json() if o.get("name")]
        if not paths:
            return
        r = httpx.request(
            "DELETE",
            f"{self.base}/storage/v1/object/{BUCKET}",
            headers=self.headers,
            json={"prefixes": paths},
            timeout=20,
        )
        r.raise_for_status()

    def delete_account(self) -> None:
        r = httpx.post(
            f"{self.base}/rest/v1/rpc/delete_my_account",
            headers=self.headers,
            json={},
            timeout=20,
        )
        r.raise_for_status()


def get_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseAccountStore:
    return SupabaseAccountStore(creds.credentials)


@router.delete("", status_code=204)
def delete_account(
    user_id: str = Depends(current_user_id),
    store: SupabaseAccountStore = Depends(get_store),
):
    try:
        store.delete_photos(user_id)
        store.delete_account()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not delete the account, try again")
    return Response(status_code=204)
