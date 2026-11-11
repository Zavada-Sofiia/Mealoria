import datetime as dt
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import bearer, current_user_id
from app.calendar.schemas import EntryIn, EntryMove, EntryOut
from app.calendar.store import SupabaseCalendarStore
from app.limits.plans import raise_if_plan_limit

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def get_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseCalendarStore:
    return SupabaseCalendarStore(creds.credentials)


@router.get("", response_model=list[EntryOut])
def week(
    start: dt.date,
    _: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
):
    return store.list(start, start + dt.timedelta(days=7))


@router.post("", response_model=EntryOut, status_code=201)
def add_entry(
    body: EntryIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
):
    try:
        return store.create(user_id, body.model_dump(mode="json"))
    except httpx.HTTPStatusError as e:
        raise_if_plan_limit(e)
        raise HTTPException(status_code=400, detail="Could not add dish to calendar")


@router.put("/{entry_id}", response_model=EntryOut)
def move_entry(
    entry_id: UUID,
    body: EntryMove,
    _: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
):
    try:
        row = store.move(str(entry_id), body.model_dump(mode="json"))
    except httpx.HTTPStatusError as e:
        raise_if_plan_limit(e)
        raise
    if row is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return row


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: UUID,
    _: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
):
    if not store.delete(str(entry_id)):
        raise HTTPException(status_code=404, detail="Entry not found")
    return Response(status_code=204)
