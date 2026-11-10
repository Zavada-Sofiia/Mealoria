import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import current_user_id
from app.calendar.router import get_store as get_calendar_store
from app.calendar.store import SupabaseCalendarStore
from app.calories.day import summarize
from app.calories.food import FoodItem, FoodSearchError, search_food
from app.profile.calc import recommended_calories
from app.profile.router import get_store as get_profile_store
from app.profile.store import SupabaseProfileStore

router = APIRouter(prefix="/api/calories", tags=["calories"])


@router.get("/food", response_model=list[FoodItem])
def food(q: str = Query(min_length=2, max_length=100), _: str = Depends(current_user_id)):
    try:
        return search_food(q)
    except FoodSearchError:
        raise HTTPException(status_code=503, detail="Food database is unavailable")


@router.get("/day")
def day(
    date: dt.date,
    user_id: str = Depends(current_user_id),
    calendar: SupabaseCalendarStore = Depends(get_calendar_store),
    profiles: SupabaseProfileStore = Depends(get_profile_store),
):
    result = summarize(calendar.list(date, date + dt.timedelta(days=1)))
    row = profiles.get(user_id)
    target = None
    if row:
        target = row["target_calories"] or recommended_calories(
            row["sex"], row["age"], row["height_cm"], float(row["weight_kg"]),
            row["activity"], row["goal"],
        )
    return {"date": date, "target": target, **result}
