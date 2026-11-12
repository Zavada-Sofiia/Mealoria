import datetime as dt
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.auth import bearer, current_user_id
from app.water.store import SupabaseWaterStore

router = APIRouter(prefix="/api/water", tags=["water"])


class WaterIn(BaseModel):
    day: dt.date
    amount_ml: int = Field(ge=10, le=3000)


class WaterEntry(BaseModel):
    id: UUID
    amount_ml: int
    created_at: str


class WaterDay(BaseModel):
    total_ml: int
    entries: list[WaterEntry]


def get_store(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> SupabaseWaterStore:
    return SupabaseWaterStore(creds.credentials)


@router.get("", response_model=WaterDay)
def water_of_day(
    day: dt.date,
    _: str = Depends(current_user_id),
    store: SupabaseWaterStore = Depends(get_store),
):
    entries = store.for_day(day)
    return WaterDay(total_ml=sum(e["amount_ml"] for e in entries), entries=entries)


@router.post("", response_model=WaterEntry, status_code=201)
def add_water(
    body: WaterIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseWaterStore = Depends(get_store),
):
    if body.day > dt.date.today() + dt.timedelta(days=1):
        raise HTTPException(status_code=422, detail="Date is in the future")
    return store.add(user_id, body.day, body.amount_ml)


@router.delete("/{entry_id}", status_code=204)
def delete_water(
    entry_id: UUID,
    _: str = Depends(current_user_id),
    store: SupabaseWaterStore = Depends(get_store),
):
    if not store.delete(str(entry_id)):
        raise HTTPException(status_code=404, detail="Entry not found")
    return Response(status_code=204)
