import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

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

    def stats(self) -> dict:
        r = httpx.post(self.url, headers=self.headers, json={}, timeout=30)
        if r.status_code in (401, 403):
            raise NotAdmin
        r.raise_for_status()
        return r.json()


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
