import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.auth import bearer, current_user_id
from app.weight.store import SupabaseWeightStore

router = APIRouter(prefix="/api/weight", tags=["weight"])


class WeightIn(BaseModel):
    day: dt.date
    weight_kg: float = Field(ge=20, le=400)


class WeightOut(BaseModel):
    day: dt.date
    weight_kg: float


def get_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseWeightStore:
    return SupabaseWeightStore(creds.credentials)


@router.get("", response_model=list[WeightOut])
def list_weights(
    _: str = Depends(current_user_id),
    store: SupabaseWeightStore = Depends(get_store),
):
    """The last year of entries, oldest first."""
    return store.list(dt.date.today() - dt.timedelta(days=366))


@router.put("", response_model=WeightOut)
def save_weight(
    body: WeightIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseWeightStore = Depends(get_store),
):
    if body.day > dt.date.today() + dt.timedelta(days=1):
        raise HTTPException(status_code=422, detail="Date is in the future")
    return store.upsert(user_id, body.day, body.weight_kg)


@router.delete("/{day}", status_code=204)
def delete_weight(
    day: dt.date,
    _: str = Depends(current_user_id),
    store: SupabaseWeightStore = Depends(get_store),
):
    if not store.delete(day):
        raise HTTPException(status_code=404, detail="Entry not found")
    return Response(status_code=204)
