import json
import os

import httpx

API = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODEL = "gemini-2.5-flash"


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
            "temperature": 0.4,
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
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        raise AIError(str(e)) from e
