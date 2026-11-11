from pydantic import BaseModel, Field


class Ingredient(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    amount: str = Field(default="", max_length=50)


class DishIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    recipe: str = Field(default="", max_length=5000)
    ingredients: list[Ingredient] = Field(default_factory=list, max_length=50)
    calories: int | None = Field(default=None, ge=0, le=5000)
    protein_g: float | None = Field(default=None, ge=0, le=1000)
    fat_g: float | None = Field(default=None, ge=0, le=1000)
    carbs_g: float | None = Field(default=None, ge=0, le=1000)
    photo_url: str | None = Field(default=None, max_length=500)
    favorite: bool = False


class DishOut(DishIn):
    id: str
