from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import bearer, current_user_id
from app.dishes.router import get_store as get_dish_store
from app.dishes.store import SupabaseDishStore
from app.limits.plans import SupabasePlanStore

router = APIRouter(prefix="/api", tags=["pricing"])


def get_plan_store(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> SupabasePlanStore:
    return SupabasePlanStore(creds.credentials)


@router.get("/plans")
def plan_table():
    """Public: the free and premium limits, shown on the pricing page."""
    return SupabasePlanStore().plan_table()


@router.get("/plan")
def my_plan(
    _: str = Depends(current_user_id),
    plans: SupabasePlanStore = Depends(get_plan_store),
    dishes: SupabaseDishStore = Depends(get_dish_store),
):
    """The signed-in user's plan, its limits and how much of the dish limit is used."""
    return {**plans.my_limits(), "dishes_used": len(dishes.list())}
