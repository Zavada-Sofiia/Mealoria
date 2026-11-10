import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field


class EntryIn(BaseModel):
    date: dt.date
    slot: int = Field(ge=0, le=7)
    dish_id: UUID


class EntryMove(BaseModel):
    date: dt.date
    slot: int = Field(ge=0, le=7)


class DishBrief(BaseModel):
    id: str
    name: str
    calories: int | None = None
    protein_g: float | None = None
    fat_g: float | None = None
    carbs_g: float | None = None


class EntryOut(BaseModel):
    id: str
    date: dt.date
    slot: int
    dish: DishBrief | None
