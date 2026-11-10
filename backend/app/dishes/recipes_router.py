from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import bearer, current_user_id
from app.dishes.recipes_schemas import RecipeOut
from app.dishes.recipes_store import SupabaseRecipeStore
from app.dishes.router import get_store as get_dish_store
from app.dishes.schemas import DishOut
from app.dishes.store import SupabaseDishStore

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def get_recipe_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseRecipeStore:
    return SupabaseRecipeStore(creds.credentials)


@router.get("", response_model=list[RecipeOut])
def list_recipes(
    q: str = "",
    _: str = Depends(current_user_id),
    recipes: SupabaseRecipeStore = Depends(get_recipe_store),
):
    return recipes.list(q)


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
    data = {k: recipe[k] for k in ("name", "recipe", "ingredients", "calories", "protein_g", "fat_g", "carbs_g")}
    return dishes.create(user_id, data)
