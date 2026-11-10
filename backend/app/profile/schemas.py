from typing import Literal

from pydantic import BaseModel, Field


class ProfileIn(BaseModel):
    sex: Literal["male", "female"]
    age: int = Field(ge=10, le=100)
    height_cm: int = Field(ge=100, le=250)
    weight_kg: float = Field(ge=30, le=300)
    activity: Literal["sedentary", "light", "moderate", "active"]
    goal: Literal["lose", "maintain", "gain"]
    meals_per_day: int = Field(default=3, ge=1, le=8)
    target_calories: int | None = Field(default=None, ge=800, le=6000)
    preferences: str = Field(default="", max_length=1000)
    allergies: str = Field(default="", max_length=1000)


class ProfileOut(BaseModel):
    profile: ProfileIn | None
    recommended_calories: int | None
