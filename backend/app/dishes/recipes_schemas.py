from pydantic import BaseModel

from app.dishes.schemas import Ingredient


class RecipeOut(BaseModel):
    id: str
    name: str
    category: str
    recipe: str
    ingredients: list[Ingredient]
    calories: int
    protein_g: float
    fat_g: float
    carbs_g: float
    fiber_g: float | None = None
    diet: str
    allergens: list[str]
    cuisine: str | None = None
    cook_minutes: int
    budget: str
    photo_url: str | None = None
