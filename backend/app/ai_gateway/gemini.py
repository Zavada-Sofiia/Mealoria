import json
import os

import httpx

API = "https://generativelanguage.googleapis.com/v1beta/models"
# The "-latest" alias follows Google's current Flash-Lite model, so retired model names stop breaking us.
# Lite is fast; the heavier Flash models "think" for a minute and time out on a free instance.
DEFAULT_MODEL = "gemini-flash-lite-latest"
# Tried in order when the first model is overloaded, times out or has been retired.
DEFAULT_FALLBACKS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]
ATTEMPT_TIMEOUT = 25  # seconds; three attempts must fit inside Render's ~100 s request limit
RETRY_STATUSES = {404, 429, 500, 502, 503, 504}


class AIError(Exception):
    pass


def is_configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def models_to_try() -> list[str]:
    first = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
    extra = os.environ.get("GEMINI_FALLBACK_MODELS")
    fallbacks = [m.strip() for m in extra.split(",") if m.strip()] if extra else DEFAULT_FALLBACKS
    ordered = [first] + [m for m in fallbacks if m != first]
    return ordered[:3]


def _call(model: str, key: str, body: dict) -> dict:
    r = httpx.post(
        f"{API}/{model}:generateContent",
        headers={"x-goog-api-key": key},
        json=body,
        timeout=ATTEMPT_TIMEOUT,
    )
    r.raise_for_status()
    return json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])


def generate_json(
    prompt: str, schema: dict, image_b64: str | None = None, mime_type: str = "image/jpeg"
) -> dict:
    """Ask Gemini for a JSON answer that follows `schema`.

    If a model is overloaded, too slow or retired, the next model in the list is tried.
    Problems that another model cannot fix (bad key, rejected request) fail immediately.
    All failures become AIError.
    """
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise AIError("GEMINI_API_KEY is not set")
    parts: list[dict] = [{"text": prompt}]
    if image_b64:
        parts.append({"inline_data": {"mime_type": mime_type, "data": image_b64}})
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema},
    }

    problems: list[str] = []
    for model in models_to_try():
        try:
            return _call(model, key, body)
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            problems.append(f"[{model}] Gemini returned {status}: {e.response.text[:200]}")
            if status not in RETRY_STATUSES:
                break
        except httpx.TransportError as e:  # timeouts, connection resets
            problems.append(f"[{model}] {type(e).__name__}: {e}")
        except (KeyError, IndexError, ValueError) as e:  # empty or non-JSON answer
            problems.append(f"[{model}] bad answer: {type(e).__name__}: {e}")
    raise AIError(" | ".join(problems))
