import logging
import os
import time

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/notice", tags=["notice"])
log = logging.getLogger(__name__)

CACHE_SECONDS = 30  # every page load asks for the notice: do not hit the database each time


class NoticeOut(BaseModel):
    active: bool = False
    level: str = "info"
    message_uk: str = ""
    message_en: str = ""


_cache: dict = {"at": 0.0, "value": NoticeOut()}


def read_notice() -> NoticeOut:
    base = os.environ["SUPABASE_URL"].strip().rstrip("/.")
    key = os.environ["SUPABASE_PUBLISHABLE_KEY"]
    r = httpx.get(
        f"{base}/rest/v1/site_notice",
        params={"select": "active,level,message_uk,message_en", "id": "eq.1"},
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=10,
    )
    r.raise_for_status()
    rows = r.json()
    return NoticeOut(**rows[0]) if rows else NoticeOut()


@router.get("", response_model=NoticeOut)
def get_notice():
    """Public. A problem here must never break the site, so any failure means "no notice"."""
    now = time.monotonic()
    if now - _cache["at"] < CACHE_SECONDS:
        return _cache["value"]
    try:
        value = read_notice()
    except Exception:
        log.exception("Could not read the site notice")
        return _cache["value"] if _cache["at"] else NoticeOut()
    _cache.update(at=now, value=value)
    return value


def forget_cache() -> None:
    _cache["at"] = 0.0
