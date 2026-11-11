from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.auth import bearer, current_user_id
from app.limits.store import SupabasePreorderStore

router = APIRouter(prefix="/api/preorder", tags=["pricing"])


class PreorderOut(BaseModel):
    preordered: bool


def get_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabasePreorderStore:
    return SupabasePreorderStore(creds.credentials)


@router.get("", response_model=PreorderOut)
def status(
    user_id: str = Depends(current_user_id),
    store: SupabasePreorderStore = Depends(get_store),
):
    return PreorderOut(preordered=store.exists(user_id))


@router.post("", response_model=PreorderOut, status_code=201)
def preorder(
    user_id: str = Depends(current_user_id),
    store: SupabasePreorderStore = Depends(get_store),
):
    store.add(user_id)
    return PreorderOut(preordered=True)

