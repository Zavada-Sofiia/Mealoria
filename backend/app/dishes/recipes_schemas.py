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
