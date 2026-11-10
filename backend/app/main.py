import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import current_user_id

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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/me")
def me(user_id: str = Depends(current_user_id)) -> dict[str, str]:
    return {"user_id": user_id}
