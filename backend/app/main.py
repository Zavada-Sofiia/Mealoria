import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import current_user_id
from app.calendar.router import router as calendar_router
from app.dishes.recipes_router import router as recipes_router
from app.dishes.router import router as dishes_router
from app.profile.router import router as profile_router

app = FastAPI(title="Mealoria API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "CORS_ORIGINS",
        "https://mealoria.zavada-sofia.workers.dev,http://localhost:5173",
    ).split(","),
    allow_headers=["Authorization", "Content-Type"],
    allow_methods=["*"],
)

app.include_router(profile_router)
app.include_router(dishes_router)
app.include_router(recipes_router)
app.include_router(calendar_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/me")
def me(user_id: str = Depends(current_user_id)) -> dict[str, str]:
    return {"user_id": user_id}
