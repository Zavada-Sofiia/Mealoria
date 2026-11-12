import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.auth import current_user_id
from app.calendar.router import get_store as get_calendar_store
from app.calendar.store import SupabaseCalendarStore
from app.calories.day import summarize
from app.calories.food import NO_NUTRITION, FoodItem, FoodSearchError, lookup_barcode, search_food
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


@router.get("/barcode/{code}", response_model=FoodItem)
def barcode(code: str = Path(pattern=r"^\d{8,14}$"), _: str = Depends(current_user_id)):
    """Calories and macros per 100 g of the product with this barcode (EAN-8, UPC-A, EAN-13, ITF-14)."""
    try:
        found = lookup_barcode(code)
    except FoodSearchError:
        raise HTTPException(status_code=503, detail="Food database is unavailable")
    if found == NO_NUTRITION:
        raise HTTPException(status_code=422, detail="no_nutrition")
    if isinstance(found, str):
        raise HTTPException(status_code=404, detail="product_not_found")
    return found


@router.get("/range")
def day_range(
    start: dt.date,
    end: dt.date,
    user_id: str = Depends(current_user_id),
    calendar: SupabaseCalendarStore = Depends(get_calendar_store),
    profiles: SupabaseProfileStore = Depends(get_profile_store),
):
    """Calories and macros for each day from `start` to `end` inclusive (at most 92 days)."""
    if end < start or (end - start).days > 91:
        raise HTTPException(status_code=422, detail="Range must be 1 to 92 days")
    by_day: dict[str, list[dict]] = {}
    for e in calendar.list(start, end + dt.timedelta(days=1)):
        by_day.setdefault(str(e["date"]), []).append(e)
    days = []
    for i in range((end - start).days + 1):
        date = (start + dt.timedelta(days=i)).isoformat()
        days.append({"date": date, **summarize(by_day.get(date, []))["total"]})
    row = profiles.get(user_id)
    target = None
    if row:
        target = row["target_calories"] or recommended_calories(
            row["sex"], row["age"], row["height_cm"], float(row["weight_kg"]),
            row["activity"], row["goal"],
        )
    return {"target": target, "days": days}


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
