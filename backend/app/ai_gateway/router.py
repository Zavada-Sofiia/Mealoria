import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.ai_gateway import prompts
from app.ai_gateway.gemini import AIBusy, generate_json, is_configured
from app.ai_gateway.quota import SupabaseQuotaStore
from app.ai_gateway.schemas import (
    MealPhotoIn,
    MealPhotoOut,
    Quota,
    RecipeIdeasIn,
    RecipeIdeasOut,
)
from app.auth import bearer, current_user_id
from app.limits.plans import SupabasePlanStore
from app.profile.router import get_store as get_profile_store
from app.profile.store import SupabaseProfileStore

router = APIRouter(prefix="/api/ai", tags=["ai"])
log = logging.getLogger(__name__)
FREE_FALLBACK_LIMIT = 3  # used only if the plan lookup itself fails


def get_quota_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseQuotaStore:
    return SupabaseQuotaStore(creds.credentials)


def get_plan_store(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> SupabasePlanStore:
    return SupabasePlanStore(creds.credentials)


def _daily_limit(plans: SupabasePlanStore) -> int:
    """Requests per day for the user's plan (free or premium)."""
    try:
        return int(plans.my_limits()["ai_per_day"])
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        log.exception("Could not read the plan, using the free limit")
        return FREE_FALLBACK_LIMIT


def _failure(message: str, error: Exception, quota: SupabaseQuotaStore) -> HTTPException:
    """502 for the user; developers (public.admins) also get the technical reason.

    A request that failed is not charged to the daily limit.
    """
    log.warning("%s: %r", message, error, exc_info=error)
    if isinstance(error, AIBusy):
        message = "AI is busy"  # the site shows a friendly "try again in a few minutes"
    reason = f"{type(error).__name__}: {error}"[:300]
    detail = f"{message}: {reason}" if quota.is_admin() else message
    return HTTPException(status_code=502, detail=detail)


def _check_quota(quota: SupabaseQuotaStore, limit: int) -> None:
    if not is_configured():
        raise HTTPException(status_code=503, detail="AI is not configured")
    status = quota.status(limit)
    if status["used"] >= status["limit"]:
        raise HTTPException(status_code=429, detail="Daily AI limit reached")


def _charge(quota: SupabaseQuotaStore, limit: int) -> None:
    """Count one successful request. Failing to count must not lose the user's answer."""
    try:
        quota.consume(limit)
    except Exception:
        log.exception("Could not record AI usage")


@router.get("/quota", response_model=Quota)
def get_quota(
    _: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
    plans: SupabasePlanStore = Depends(get_plan_store),
):
    status = quota.status(_daily_limit(plans))
    return Quota(used=status["used"], limit=status["limit"])


@router.post("/meal-photo", response_model=MealPhotoOut)
def meal_photo(
    body: MealPhotoIn,
    _: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
    plans: SupabasePlanStore = Depends(get_plan_store),
):
    limit = _daily_limit(plans)
    _check_quota(quota, limit)
    try:
        data = generate_json(
            prompts.MEAL_PHOTO_PROMPT, prompts.MEAL_PHOTO_SCHEMA, body.image_base64, body.mime_type
        )
        result = MealPhotoOut(**data)
        _charge(quota, limit)
        return result
    except Exception as e:  # any failure must become a JSON 502 the browser can read
        raise _failure("AI could not analyse the photo", e, quota)


@router.post("/recipes", response_model=RecipeIdeasOut)
def recipe_ideas(
    body: RecipeIdeasIn,
    user_id: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
    profiles: SupabaseProfileStore = Depends(get_profile_store),
    plans: SupabasePlanStore = Depends(get_plan_store),
):
    limit = _daily_limit(plans)
    _check_quota(quota, limit)
    try:
        prompt = prompts.recipe_prompt(profiles.get(user_id), body.category, body.note.strip())
        result = RecipeIdeasOut(**generate_json(prompt, prompts.RECIPES_SCHEMA))
        _charge(quota, limit)
        return result
    except Exception as e:  # any failure must become a JSON 502 the browser can read
        raise _failure("AI could not suggest recipes", e, quota)
