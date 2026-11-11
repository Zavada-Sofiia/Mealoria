import base64
import os

import httpx

DEFAULT_MODEL = "@cf/black-forest-labs/flux-1-schnell"
STYLE = "appetizing food photography, top-down view, natural light, wooden table, no text"
TIMEOUT = 60


class ImageError(Exception):
    pass


class ImageBusy(ImageError):
    """Cloudflare is overloaded or the free daily budget is used up; later attempts should work."""


def is_image_configured() -> bool:
    return bool(os.environ.get("CF_ACCOUNT_ID") and os.environ.get("CF_API_TOKEN"))


def generate_image(description: str) -> str:
    """Returns a base64 JPEG for `description` (an English description of the dish)."""
    account = os.environ.get("CF_ACCOUNT_ID")
    token = os.environ.get("CF_API_TOKEN")
    if not (account and token):
        raise ImageError("CF_ACCOUNT_ID or CF_API_TOKEN is not set")
    model = os.environ.get("CF_IMAGE_MODEL", DEFAULT_MODEL)
    try:
        r = httpx.post(
            f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}",
            headers={"Authorization": f"Bearer {token}"},
            json={"prompt": f"{description}, {STYLE}", "steps": 6},
            timeout=TIMEOUT,
        )
        data = r.json()
    except httpx.TransportError as e:
        raise ImageBusy(f"{type(e).__name__}: {e}") from e
    except ValueError as e:
        raise ImageError(f"Cloudflare returned a non-JSON answer (HTTP {r.status_code})") from e

    if r.status_code >= 400 or not data.get("success"):
        errors = str(data.get("errors") or data)[:300]
        text = f"[{model}] Cloudflare returned {r.status_code}: {errors}"
        # 429/5xx and "out of neurons" style messages are temporary
        busy = r.status_code in (429, 500, 502, 503, 504) or "limit" in errors.lower()
        raise (ImageBusy if busy else ImageError)(text)
    try:
        image = data["result"]["image"]
        base64.b64decode(image, validate=True)
    except (KeyError, TypeError, ValueError) as e:
        raise ImageError(f"Cloudflare answer has no image: {type(e).__name__}") from e
    return image
