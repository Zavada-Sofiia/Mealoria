from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import bearer, current_user_id
from app.dishes.preferences import apply_preferences
from app.dishes.recipes_schemas import RecipeOut
from app.dishes.recipes_store import SupabaseRecipeStore
from app.dishes.router import get_store as get_dish_store
from app.dishes.schemas import DishOut
from app.dishes.store import SupabaseDishStore
from app.limits.plans import raise_if_plan_limit
from app.profile.router import get_store as get_profile_store
from app.profile.store import SupabaseProfileStore

MEALS = ('сніданок', 'обід', 'вечеря', 'перекус')
KINDS = ('основна страва', 'суп', 'салат', 'гарнір', 'закуска', 'десерт', 'випічка', 'напій')

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def get_recipe_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseRecipeStore:
    return SupabaseRecipeStore(creds.credentials)


@router.get("", response_model=list[RecipeOut])
def list_recipes(
    q: str = "",
    for_me: bool = False,
    user_id: str = Depends(current_user_id),
    recipes: SupabaseRecipeStore = Depends(get_recipe_store),
    profiles: SupabaseProfileStore = Depends(get_profile_store),
):
    found = recipes.list(q)
    prefs = profiles.get(user_id) if for_me else None
    return apply_preferences(found, prefs) if prefs else found


@router.post("/{recipe_id}/save", response_model=DishOut, status_code=201)
def save_to_my_dishes(
    recipe_id: UUID,
    user_id: str = Depends(current_user_id),
    recipes: SupabaseRecipeStore = Depends(get_recipe_store),
    dishes: SupabaseDishStore = Depends(get_dish_store),
):
    recipe = recipes.get(str(recipe_id))
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    # saving the same recipe again (for example "To calendar" after "To my dishes") must not
    # create a second copy: hand back the dish the user already has
    wanted = (recipe.get("name") or "").strip().casefold()
    for existing in dishes.list():
        if (existing.get("name") or "").strip().casefold() == wanted:
            return existing
    fields = ("name", "recipe", "ingredients", "calories", "protein_g", "fat_g", "carbs_g", "fiber_g", "photo_url")
    data = {k: recipe.get(k) for k in fields}
    # the meal and the kind of the recipe become the categories of the dish
    data["categories"] = [
        c
        for c in (recipe.get("category"), recipe.get("kind"))
        if c in MEALS or c in KINDS
    ]
    try:
        return dishes.create(user_id, data)
    except httpx.HTTPStatusError as e:
        raise_if_plan_limit(e)
        raise
