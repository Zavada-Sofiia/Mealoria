import logging

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.ai_gateway import prompts
from app.ai_gateway.gemini import AIBusy, generate_json, is_configured
from app.ai_gateway.images import ImageBusy, generate_image, is_image_configured
from app.ai_gateway.quota import SupabaseQuotaStore
from app.ai_gateway.schemas import (
    DishImageIn,
    DishImageOut,
    DishNutritionIn,
    DishRecipeIn,
    DishRecipeOut,
    FridgeIn,
    FridgeOut,
    MealPhotoIn,
    MealPhotoOut,
    NutritionOut,
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


def get_image_quota_store(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> SupabaseQuotaStore:
    return SupabaseQuotaStore(creds.credentials, counter="image_quota")


def _limits(plans: SupabasePlanStore) -> dict:
    try:
        return plans.my_limits()
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        log.exception("Could not read the plan, using the free limits")
        return {"plan": "free", "ai_per_day": FREE_FALLBACK_LIMIT, "photos_per_day": 0}


def _daily_limit(plans: SupabasePlanStore) -> int:
    """Text/photo-analysis requests per day for the user's plan (free or premium)."""
    return int(_limits(plans)["ai_per_day"])


def _is_premium(plans: SupabasePlanStore) -> bool:
    return _limits(plans).get("plan") == "premium"


def _photos_limit(plans: SupabasePlanStore) -> int:
    """AI-generated dish photos per day; 0 means the plan does not include them."""
    return int(_limits(plans).get("photos_per_day", 0))


def _failure(message: str, error: Exception, quota: SupabaseQuotaStore) -> HTTPException:
    """502 for the user; developers (public.admins) also get the technical reason.

    A request that failed is not charged to the daily limit.
    """
    log.warning("%s: %r", message, error, exc_info=error)
    if isinstance(error, (AIBusy, ImageBusy)):
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
    images: SupabaseQuotaStore = Depends(get_image_quota_store),
):
    status = quota.status(_daily_limit(plans))
    images_used, images_limit = 0, _photos_limit(plans)
    if images_limit > 0:
        try:
            images_used = images.status(images_limit)["used"]
        except (httpx.HTTPError, KeyError, ValueError):
            log.exception("Could not read the AI photo counter")
    return Quota(
        used=status["used"], limit=status["limit"], images_used=images_used, images_limit=images_limit
    )


@router.post("/meal-photo", response_model=MealPhotoOut)
def meal_photo(
    body: MealPhotoIn,
    _: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
    plans: SupabasePlanStore = Depends(get_plan_store),
    lang: str = Header(default="uk", alias="X-Lang"),
):
    limit = _daily_limit(plans)
    _check_quota(quota, limit)
    try:
        data = generate_json(
            prompts.with_language(prompts.MEAL_PHOTO_PROMPT, lang),
            prompts.MEAL_PHOTO_SCHEMA,
            body.image_base64,
            body.mime_type,
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
    lang: str = Header(default="uk", alias="X-Lang"),
):
    limit = _daily_limit(plans)
    _check_quota(quota, limit)
    try:
        prompt = prompts.with_language(
            prompts.recipe_prompt(profiles.get(user_id), body.category, body.note.strip()), lang
        )
        result = RecipeIdeasOut(**generate_json(prompt, prompts.RECIPES_SCHEMA))
        _charge(quota, limit)
        return result
    except Exception as e:  # any failure must become a JSON 502 the browser can read
        raise _failure("AI could not suggest recipes", e, quota)


def _english_description(body: DishImageIn) -> str:
    """The image model understands English far better, so Gemini describes the dish in English."""
    try:
        data = generate_json(
            prompts.image_description_prompt(body.name, [i.name for i in body.ingredients]),
            prompts.IMAGE_DESCRIPTION_SCHEMA,
        )
        text = str(data.get("description", "")).strip()
        if text:
            return text[:300]
    except Exception as e:
        log.warning("Could not describe the dish in English, using its name: %r", e)
    return body.name


@router.post("/dish-image", response_model=DishImageOut)
def dish_image(
    body: DishImageIn,
    _: str = Depends(current_user_id),
    images: SupabaseQuotaStore = Depends(get_image_quota_store),
    plans: SupabasePlanStore = Depends(get_plan_store),
):
    """Premium: draw a photo of a dish. The browser shows a preview and uploads it if accepted."""
    limit = _photos_limit(plans)
    if limit <= 0:
        raise HTTPException(status_code=403, detail="premium_required")
    if not is_image_configured():
        raise HTTPException(status_code=503, detail="AI is not configured")
    status = images.status(limit)
    if status["used"] >= status["limit"]:
        raise HTTPException(status_code=429, detail="Daily AI photo limit reached")
    try:
        image = generate_image(_english_description(body))
        _charge(images, limit)
        return DishImageOut(image_base64=image)
    except Exception as e:  # any failure must become a JSON 502 the browser can read
        raise _failure("AI could not draw the dish", e, images)


@router.post("/dish-nutrition", response_model=NutritionOut)
def dish_nutrition(
    body: DishNutritionIn,
    _: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
    plans: SupabasePlanStore = Depends(get_plan_store),
):
    """Premium: estimate calories and macros of a dish from its name and ingredients."""
    if not _is_premium(plans):
        raise HTTPException(status_code=403, detail="premium_required")
    limit = _daily_limit(plans)
    _check_quota(quota, limit)
    try:
        prompt = prompts.nutrition_prompt(
            body.name, [i.model_dump() for i in body.ingredients], body.recipe, body.servings
        )
        result = NutritionOut(**generate_json(prompt, prompts.NUTRITION_SCHEMA))
        _charge(quota, limit)
        return result
    except Exception as e:  # any failure must become a JSON 502 the browser can read
        raise _failure("AI could not estimate the nutrition", e, quota)


@router.post("/dish-recipe", response_model=DishRecipeOut)
def dish_recipe(
    body: DishRecipeIn,
    user_id: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
    profiles: SupabaseProfileStore = Depends(get_profile_store),
    plans: SupabasePlanStore = Depends(get_plan_store),
    lang: str = Header(default="uk", alias="X-Lang"),
):
    """Premium: write a recipe and the ingredients for a dish from its name (respects the user's profile)."""
    if not _is_premium(plans):
        raise HTTPException(status_code=403, detail="premium_required")
    limit = _daily_limit(plans)
    _check_quota(quota, limit)
    try:
        prompt = prompts.with_language(
            prompts.dish_recipe_prompt(
                body.name.strip(), profiles.get(user_id), body.note.strip(), body.servings
            ),
            lang,
        )
        result = DishRecipeOut(**generate_json(prompt, prompts.DISH_RECIPE_SCHEMA))
        _charge(quota, limit)
        return result
    except Exception as e:  # any failure must become a JSON 502 the browser can read
        raise _failure("AI could not write the recipe", e, quota)


@router.post("/fridge-recipes", response_model=FridgeOut)
def fridge_recipes(
    body: FridgeIn,
    user_id: str = Depends(current_user_id),
    quota: SupabaseQuotaStore = Depends(get_quota_store),
    profiles: SupabaseProfileStore = Depends(get_profile_store),
    plans: SupabasePlanStore = Depends(get_plan_store),
    lang: str = Header(default="uk", alias="X-Lang"),
):
    """Recipes from the products the user already has (one AI request, like the usual recipe ideas)."""
    limit = _daily_limit(plans)
    _check_quota(quota, limit)
    try:
        prompt = prompts.with_language(
            prompts.fridge_prompt(
                profiles.get(user_id), body.ingredients, body.category, body.strict, body.note.strip()
            ),
            lang,
        )
        result = FridgeOut(**generate_json(prompt, prompts.FRIDGE_SCHEMA))
        _charge(quota, limit)
        return result
    except Exception as e:  # any failure must become a JSON 502 the browser can read
        raise _failure("AI could not suggest recipes from the fridge", e, quota)
