import datetime as dt
import random
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import bearer, current_user_id
from app.calendar.autoplan import missing_for_catalog, plan_week
from app.calendar.schemas import EntryIn, EntryMove, EntryOut
from app.calendar.store import SupabaseCalendarStore
from app.dishes.preferences import apply_preferences
from app.dishes.recipes_router import get_recipe_store
from app.dishes.recipes_store import SupabaseRecipeStore
from app.dishes.router import get_store as get_dish_store
from app.dishes.store import SupabaseDishStore
from app.limits.plans import plan_limit_of, raise_if_plan_limit
from app.profile.calc import recommended_calories
from app.profile.router import get_store as get_profile_store
from app.profile.store import SupabaseProfileStore

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def get_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseCalendarStore:
    return SupabaseCalendarStore(creds.credentials)


@router.get("", response_model=list[EntryOut])
def week(
    start: dt.date,
    _: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
):
    return store.list(start, start + dt.timedelta(days=7))


@router.post("", response_model=EntryOut, status_code=201)
def add_entry(
    body: EntryIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
):
    try:
        return store.create(user_id, body.model_dump(mode="json"))
    except httpx.HTTPStatusError as e:
        raise_if_plan_limit(e)
        raise HTTPException(status_code=400, detail="Could not add dish to calendar")


@router.post("/copy-week", response_model=list[EntryOut])
def copy_previous_week(
    start: dt.date,
    user_id: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
):
    """Copies the week before `start` into the week that begins on `start`, skipping what is already there."""
    previous = start - dt.timedelta(days=7)
    taken = {(e["date"], e["slot"], e["dish"]["id"]) for e in store.list(start, start + dt.timedelta(days=7)) if e["dish"]}
    rows = []
    for e in store.list(previous, start):
        if not e["dish"]:
            continue
        date = dt.date.fromisoformat(str(e["date"])) + dt.timedelta(days=7)
        if (date.isoformat(), e["slot"], e["dish"]["id"]) in taken:
            continue
        rows.append({"date": date.isoformat(), "slot": e["slot"], "dish_id": e["dish"]["id"]})
    try:
        store.create_many(user_id, rows)
    except httpx.HTTPStatusError as err:
        raise_if_plan_limit(err)
        raise HTTPException(status_code=400, detail="Could not copy the week")
    return store.list(start, start + dt.timedelta(days=7))


DISH_FROM_RECIPE = ("name", "recipe", "ingredients", "calories", "protein_g", "fat_g", "carbs_g", "fiber_g", "photo_url")


def _top_up_from_catalog(user_id, dishes, meals, profile, recipes, dish_store, rng) -> int:
    """When there are few dishes for a meal type, saves fitting recipes from the catalog as the user's dishes."""
    need = missing_for_catalog(dishes, meals)
    if not need:
        return 0
    catalog = recipes.list()
    if profile:
        catalog = apply_preferences(catalog, profile)
    owned = {(d.get("name") or "").strip().casefold() for d in dishes}
    saved = 0
    for category, count in need.items():
        picks = [r for r in catalog if r.get("category") == category and (r["name"] or "").strip().casefold() not in owned]
        rng.shuffle(picks)
        for recipe in picks[:count]:
            data = {k: recipe.get(k) for k in DISH_FROM_RECIPE}
            data["categories"] = [category]
            try:
                created = dish_store.create(user_id, data)
            except httpx.HTTPStatusError as e:
                if plan_limit_of(e):
                    return saved  # the plan's dish limit is reached: plan with what there is
                raise
            dishes.append(created)
            owned.add((recipe["name"] or "").strip().casefold())
            saved += 1
    return saved


@router.post("/auto-plan")
def auto_plan(
    start: dt.date,
    since: dt.date | None = None,
    use_catalog: bool = True,
    user_id: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
    dish_store: SupabaseDishStore = Depends(get_dish_store),
    profiles: SupabaseProfileStore = Depends(get_profile_store),
    recipes: SupabaseRecipeStore = Depends(get_recipe_store),
):
    """Fills the empty meals of the week that begins on `start` (from `since`, usually today) with dishes
    that suit each meal and the daily calories. Meals that already have a dish are left alone."""
    profile = profiles.get(user_id)
    meals = profile["meals_per_day"] if profile else 3
    target = None
    if profile:
        target = profile["target_calories"] or recommended_calories(
            profile["sex"], profile["age"], profile["height_cm"], float(profile["weight_kg"]),
            profile["activity"], profile["goal"],
        )
    rng = random.Random()
    try:
        dishes = dish_store.list()
        saved = _top_up_from_catalog(user_id, dishes, meals, profile, recipes, dish_store, rng) if use_catalog else 0
        existing = store.list(start, start + dt.timedelta(days=7))
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Could not prepare the plan")

    first = max(start, since) if since else start
    dates = [start + dt.timedelta(days=i) for i in range(7) if start + dt.timedelta(days=i) >= first]
    rows, unfilled = plan_week(dishes, existing, dates, meals, target, rng)

    added, limited = 0, False
    try:
        store.create_many(user_id, rows)
        added = len(rows)
    except httpx.HTTPStatusError as err:
        if not plan_limit_of(err):
            raise HTTPException(status_code=400, detail="Could not fill the week")
        limited = True  # some days are beyond what the plan allows: add the days that are allowed
        for row in rows:
            try:
                store.create_many(user_id, [row])
                added += 1
            except httpx.HTTPStatusError as inner:
                if not plan_limit_of(inner):
                    raise HTTPException(status_code=400, detail="Could not fill the week")
    return {
        "entries": store.list(start, start + dt.timedelta(days=7)),
        "added": added,
        "saved_from_catalog": saved,
        "unfilled": unfilled,
        "limited": limited,
    }


@router.put("/{entry_id}", response_model=EntryOut)
def move_entry(
    entry_id: UUID,
    body: EntryMove,
    _: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
):
    try:
        row = store.move(str(entry_id), body.model_dump(mode="json"))
    except httpx.HTTPStatusError as e:
        raise_if_plan_limit(e)
        raise
    if row is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return row


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: UUID,
    _: str = Depends(current_user_id),
    store: SupabaseCalendarStore = Depends(get_store),
):
    if not store.delete(str(entry_id)):
        raise HTTPException(status_code=404, detail="Entry not found")
    return Response(status_code=204)
