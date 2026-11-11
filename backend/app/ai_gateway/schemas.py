from typing import Literal

from pydantic import BaseModel, Field

from app.dishes.schemas import Ingredient


class Quota(BaseModel):
    used: int
    limit: int
    images_used: int = 0
    images_limit: int = 0  # 0 = AI dish photos are not part of this plan


class MealPhotoIn(BaseModel):
    image_base64: str = Field(min_length=100, max_length=4_000_000)
    mime_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"


class MealPhotoOut(BaseModel):
    is_food: bool
    name: str = ""
    calories: int = Field(default=0, ge=0, le=5000)
    protein_g: float = Field(default=0, ge=0, le=1000)
    fat_g: float = Field(default=0, ge=0, le=1000)
    carbs_g: float = Field(default=0, ge=0, le=1000)
    ingredients: list[Ingredient] = Field(default_factory=list, max_length=30)
    comment: str = ""


class RecipeIdeasIn(BaseModel):
    category: Literal["сніданок", "обід", "вечеря", "перекус"] | None = None
    note: str = Field(default="", max_length=200)


class RecipeIdea(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: str
    calories: int = Field(ge=0, le=5000)
    protein_g: float = Field(ge=0, le=1000)
    fat_g: float = Field(ge=0, le=1000)
    carbs_g: float = Field(ge=0, le=1000)
    cook_minutes: int = Field(ge=1, le=600)
    ingredients: list[Ingredient] = Field(max_length=30)
    recipe: str = Field(max_length=5000)


class RecipeIdeasOut(BaseModel):
    recipes: list[RecipeIdea]


class DishImageIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ingredients: list[Ingredient] = Field(default_factory=list, max_length=30)


class DishImageOut(BaseModel):
    image_base64: str


class DishNutritionIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ingredients: list[Ingredient] = Field(default_factory=list, max_length=30)
    recipe: str = Field(default="", max_length=2000)


class NutritionOut(BaseModel):
    calories: int = Field(ge=0, le=5000)
    protein_g: float = Field(ge=0, le=1000)
    fat_g: float = Field(ge=0, le=1000)
    carbs_g: float = Field(ge=0, le=1000)
