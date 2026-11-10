from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import bearer, current_user_id
from app.profile.calc import recommended_calories
from app.profile.schemas import ProfileIn, ProfileOut
from app.profile.store import SupabaseProfileStore

router = APIRouter(prefix="/api/profile", tags=["profile"])


def get_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseProfileStore:
    return SupabaseProfileStore(creds.credentials)


def _out(profile: ProfileIn | None) -> ProfileOut:
    if profile is None:
        return ProfileOut(profile=None, recommended_calories=None)
    rec = recommended_calories(
        profile.sex,
        profile.age,
        profile.height_cm,
        profile.weight_kg,
        profile.activity,
        profile.goal,
    )
    return ProfileOut(profile=profile, recommended_calories=rec)


@router.get("", response_model=ProfileOut)
def read_profile(
    user_id: str = Depends(current_user_id),
    store: SupabaseProfileStore = Depends(get_store),
) -> ProfileOut:
    row = store.get(user_id)
    return _out(ProfileIn(**row) if row else None)


@router.put("", response_model=ProfileOut)
def save_profile(
    body: ProfileIn,
    user_id: str = Depends(current_user_id),
    store: SupabaseProfileStore = Depends(get_store),
) -> ProfileOut:
    try:
        store.save(user_id, body.model_dump())
    except Exception:
        raise HTTPException(status_code=502, detail="Could not save profile")
    return _out(body)
