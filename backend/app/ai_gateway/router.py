import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from app.ai_gateway import prompts
from app.ai_gateway.gemini import AIError, generate_json, is_configured
from app.ai_gateway.quota import SupabaseQuotaStore, daily_limit
from app.ai_gateway.schemas import (
    MealPhotoIn,
    MealPhotoOut,
    Quota,
    RecipeIdeasIn,
    RecipeIdeasOut,
)
from app.auth import bearer, current_user_id
from app.profile.router import get_store as get_profile_store
from app.profile.store import SupabaseProfileStore

router = APIRouter(prefix="/api/ai", tags=["ai"])
log = logging.getLogger(__name__)


def get_quota_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseQuotaStore:
    return SupabaseQuotaStore(creds.credentials)


def _failure(message: str, error: Exception, quota: SupabaseQuotaStore) -> HTTPException:
    """502 for the user; developers (public.admins) also get the technical reason."""
    log.warning("%s: %s", message, error)
    detail = f"{message}: {str(error)[:300]}" if quota.is_admin() else message
    return HTTPException(status_code=502, detail=detail)


def _use_quota(quota: SupabaseQuotaStore) -> None:
    if not is_configured():
        raise HTTPException(status_code=503, detail="AI is not configured")
    if not quota.consume(daily_limit())["allowed"]:
        raise HTTPException(status_code=429, detail="Daily AI limit reached")


@router.get("/quota", response_model=Quota)
def get_quota(
    _: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
):
    status = quota.status(daily_limit())
    return Quota(used=status["used"], limit=status["limit"])


@router.post("/meal-photo", response_model=MealPhotoOut)
def meal_photo(
    body: MealPhotoIn,
    _: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
):
    _use_quota(quota)
    try:
        data = generate_json(
            prompts.MEAL_PHOTO_PROMPT, prompts.MEAL_PHOTO_SCHEMA, body.image_base64, body.mime_type
        )
        return MealPhotoOut(**data)
    except (AIError, ValidationError, TypeError) as e:
        raise _failure("AI could not analyse the photo", e, quota)


@router.post("/recipes", response_model=RecipeIdeasOut)
def recipe_ideas(
    body: RecipeIdeasIn,
    user_id: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
    profiles: SupabaseProfileStore = Depends(get_profile_store),
):
    _use_quota(quota)
    prompt = prompts.recipe_prompt(profiles.get(user_id), body.category, body.note.strip())
    try:
        return RecipeIdeasOut(**generate_json(prompt, prompts.RECIPES_SCHEMA))
    except (AIError, ValidationError, TypeError) as e:
        raise _failure("AI could not suggest recipes", e, quota)
