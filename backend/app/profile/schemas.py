from typing import Literal

from pydantic import BaseModel, Field, field_validator


Diet = Literal["any", "vegetarian", "vegan", "pescatarian"]
Allergen = Literal[
    "gluten", "lactose", "nuts", "peanuts", "eggs", "fish", "seafood", "soy",
    "sesame", "mustard", "celery", "honey", "citrus", "berries", "cocoa", "mushrooms",
    "corn", "legumes", "tomatoes",
]
Cuisine = Literal["ukrainian", "italian", "asian", "georgian", "mediterranean"]
CookTime = Literal["15", "30", "60", "any"]
Budget = Literal["low", "medium", "any"]


class ProfileIn(BaseModel):
    first_name: str = Field(default="", max_length=60)
    last_name: str = Field(default="", max_length=60)
    sex: Literal["male", "female"]
    age: int = Field(ge=10, le=100)
    height_cm: int = Field(ge=100, le=250)
    weight_kg: float = Field(ge=30, le=300)
    activity: Literal["sedentary", "light", "moderate", "active"]
    goal: Literal["lose", "maintain", "gain"]
    meals_per_day: int = Field(default=3, ge=1, le=8)
    target_calories: int | None = Field(default=None, ge=800, le=6000)
    diet: Diet = "any"
    allergens: list[Allergen] = Field(default_factory=list, max_length=19)
    cuisines: list[Cuisine] = Field(default_factory=list, max_length=5)
    cook_time: CookTime = "any"
    budget: Budget = "any"
    preferences: str = Field(default="", max_length=1000)
    allergies: str = Field(default="", max_length=1000)

    @field_validator("first_name", "last_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return " ".join(v.split())


class ProfileOut(BaseModel):
    profile: ProfileIn | None
    recommended_calories: int | None
