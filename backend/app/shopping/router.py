import datetime as dt
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import bearer, current_user_id
from app.shopping.aggregate import build_items, norm
from app.shopping.schemas import CheckIn, PantryBulkIn, PantryIn, PantryItem, ShoppingOut
from app.shopping.store import SupabaseShoppingStore

router = APIRouter(prefix="/api/shopping", tags=["shopping"])


def get_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseShoppingStore:
    return SupabaseShoppingStore(creds.credentials)


@router.get("", response_model=ShoppingOut)
def shopping_list(
    start: dt.date,
    _: str = Depends(current_user_id),
    store: SupabaseShoppingStore = Depends(get_store),
):
    plan = store.plan(start, start + dt.timedelta(days=7))
    at_home = {p["name"] for p in store.pantry()}
    checked = {norm(n) for n in store.checks(start)}
    items, home = build_items(plan, at_home, checked)
    return ShoppingOut(items=items, at_home=home)


@router.put("/check", status_code=204)
def set_check(
    body: CheckIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseShoppingStore = Depends(get_store),
):
    store.set_check(user_id, body.start, norm(body.name), body.checked)
    return Response(status_code=204)


@router.get("/pantry", response_model=list[PantryItem])
def list_pantry(
    _: str = Depends(current_user_id),
    store: SupabaseShoppingStore = Depends(get_store),
):
    return store.pantry()


@router.post("/pantry", response_model=list[PantryItem], status_code=201)
def add_pantry(
    body: PantryIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseShoppingStore = Depends(get_store),
):
    store.pantry_add(user_id, norm(body.name))
    return store.pantry()


@router.post("/pantry/bulk", response_model=list[PantryItem], status_code=201)
def add_pantry_many(
    body: PantryBulkIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseShoppingStore = Depends(get_store),
):
    """Adds several products at once (one request); empty, too long and repeated names are skipped."""
    names = list(dict.fromkeys(n for n in (norm(x) for x in body.names) if 0 < len(n) <= 100))
    if names:
        store.pantry_add_many(user_id, names)
    return store.pantry()


@router.delete("/pantry/{item_id}", status_code=204)
def delete_pantry(
    item_id: UUID,
    _: str = Depends(current_user_id),
    store: SupabaseShoppingStore = Depends(get_store),
):
    store.pantry_delete(str(item_id))
    return Response(status_code=204)
