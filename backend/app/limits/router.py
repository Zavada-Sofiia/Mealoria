from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.auth import bearer, current_user_id
from app.limits.store import SupabasePreorderStore

router = APIRouter(prefix="/api/preorder", tags=["pricing"])


class PreorderOut(BaseModel):
    preordered: bool
    months: int | None = None  # the period chosen: 1, 3, 6 or 12 months


class PreorderIn(BaseModel):
    months: Literal[1, 3, 6, 12] = 1


def get_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabasePreorderStore:
    return SupabasePreorderStore(creds.credentials)


@router.get("", response_model=PreorderOut)
def status(
    user_id: str = Depends(current_user_id),
    store: SupabasePreorderStore = Depends(get_store),
):
    row = store.get(user_id)
    return PreorderOut(preordered=row is not None, months=row["months"] if row else None)


@router.post("", response_model=PreorderOut, status_code=201)
def preorder(
    body: PreorderIn | None = None,
    user_id: str = Depends(current_user_id),
    store: SupabasePreorderStore = Depends(get_store),
):
    months = body.months if body else 1
    store.add(user_id, months)
    return PreorderOut(preordered=True, months=months)

