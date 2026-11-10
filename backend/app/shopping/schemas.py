import datetime as dt
from uuid import UUID

from pydantic import BaseModel, Field


class ShoppingItem(BaseModel):
    name: str
    amount: str
    checked: bool


class ShoppingOut(BaseModel):
    items: list[ShoppingItem]
    at_home: list[str]


class CheckIn(BaseModel):
    start: dt.date
    name: str = Field(min_length=1, max_length=100)
    checked: bool


class PantryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class PantryItem(BaseModel):
    id: UUID
    name: str
