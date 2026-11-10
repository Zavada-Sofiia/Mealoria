import os

from fastapi import HTTPException


def check_photo_url(url: str | None, user_id: str) -> None:
    """Accept only photos stored in our bucket: the user's own folder or the catalog."""
    if url is None:
        return
    base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
    bucket = f"{base}/storage/v1/object/public/dish-photos/"
    if not url.startswith((f"{bucket}{user_id}/", f"{bucket}recipes/")) or ".." in url:
        raise HTTPException(status_code=422, detail="Photo must be uploaded to Mealoria")
