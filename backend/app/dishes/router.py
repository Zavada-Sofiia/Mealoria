from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import bearer, current_user_id
from app.dishes.photos import check_photo_url
from app.dishes.schemas import DishIn, DishOut
from app.dishes.store import SupabaseDishStore

router = APIRouter(prefix="/api/dishes", tags=["dishes"])


def get_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseDishStore:
    return SupabaseDishStore(creds.credentials)


@router.get("", response_model=list[DishOut])
def list_dishes(
    _: str = Depends(current_user_id),
    store: SupabaseDishStore = Depends(get_store),
):
    return store.list()


@router.post("", response_model=DishOut, status_code=201)
def create_dish(
    body: DishIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseDishStore = Depends(get_store),
):
    check_photo_url(body.photo_url, user_id)
    return store.create(user_id, body.model_dump())


@router.put("/{dish_id}", response_model=DishOut)
def update_dish(
    dish_id: UUID,
    body: DishIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseDishStore = Depends(get_store),
):
    check_photo_url(body.photo_url, user_id)
    row = store.update(str(dish_id), body.model_dump())
    if row is None:
        raise HTTPException(status_code=404, detail="Dish not found")
    return row


@router.delete("/{dish_id}", status_code=204)
def delete_dish(
    dish_id: UUID,
    _: str = Depends(current_user_id),
    store: SupabaseDishStore = Depends(get_store),
):
    if not store.delete(str(dish_id)):
        raise HTTPException(status_code=404, detail="Dish not found")
    return Response(status_code=204)
