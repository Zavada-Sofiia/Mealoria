from fastapi import Depends, FastAPI

from app.auth import current_user_id

app = FastAPI(title="Mealoria API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/me")
def me(user_id: str = Depends(current_user_id)) -> dict[str, str]:
    return {"user_id": user_id}
