import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.account.router import router as account_router
from app.admin.router import router as admin_router
from app.ai_gateway.router import router as ai_router
from app.auth import current_user_id
from app.calendar.router import router as calendar_router
from app.calories.router import router as calories_router
from app.dishes.recipes_router import router as recipes_router
from app.dishes.router import router as dishes_router
from app.limits.plan_router import router as plans_router
from app.limits.router import router as limits_router
from app.monitoring import init_sentry
from app.notice.router import router as notice_router
from app.payments.router import router as payments_router
from app.profile.router import router as profile_router
from app.promo.router import router as promo_router
from app.shopping.router import router as shopping_router
from app.water.router import router as water_router
from app.weight.router import router as weight_router

init_sentry()  # no-op unless SENTRY_DSN is set

app = FastAPI(title="Mealoria API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "CORS_ORIGINS",
        "https://mealoria.mealoria.workers.dev,http://localhost:5173",
    ).split(","),
    allow_headers=["Authorization", "Content-Type", "X-Lang"],
    allow_methods=["*"],
)

app.include_router(profile_router)
app.include_router(dishes_router)
app.include_router(recipes_router)
app.include_router(calendar_router)
app.include_router(shopping_router)
app.include_router(calories_router)
app.include_router(limits_router)
app.include_router(plans_router)
app.include_router(promo_router)
app.include_router(payments_router)
app.include_router(notice_router)
app.include_router(ai_router)
app.include_router(admin_router)
app.include_router(weight_router)
app.include_router(water_router)
app.include_router(account_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/me")
def me(user_id: str = Depends(current_user_id)) -> dict[str, str]:
    return {"user_id": user_id}
