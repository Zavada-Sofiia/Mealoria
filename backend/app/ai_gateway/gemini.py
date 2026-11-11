import json
import os

import httpx

API = "https://generativelanguage.googleapis.com/v1beta/models"
# The "-latest" alias follows Google's current Flash-Lite model, so retired model names stop breaking us.
# Lite is fast; the heavier Flash models "think" for a minute and time out on a free instance.
# Pin a specific model with the GEMINI_MODEL environment variable if needed.
DEFAULT_MODEL = "gemini-flash-lite-latest"


class AIError(Exception):
    pass


def is_configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def generate_json(
    prompt: str, schema: dict, image_b64: str | None = None, mime_type: str = "image/jpeg"
) -> dict:
    """Ask Gemini for a JSON answer that follows `schema`. All failures become AIError."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise AIError("GEMINI_API_KEY is not set")
    model = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
    parts: list[dict] = [{"text": prompt}]
    if image_b64:
        parts.append({"inline_data": {"mime_type": mime_type, "data": image_b64}})
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }
    try:
        r = httpx.post(
            f"{API}/{model}:generateContent",
            headers={"x-goog-api-key": key},
            json=body,
            timeout=60,
        )
        r.raise_for_status()
        return json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
    except httpx.HTTPStatusError as e:
        # Gemini explains problems (bad key, unknown model, quota) in the response body
        raise AIError(
            f"[{model}] Gemini returned {e.response.status_code}: {e.response.text[:300]}"
        ) from e
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        raise AIError(f"[{model}] {type(e).__name__}: {e}") from e
