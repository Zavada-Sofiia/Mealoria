import os

import sentry_sdk


def _drop_expected(event: dict, hint: dict) -> dict | None:
    """Do not report errors that are normal behaviour (a user pressing a limit, a busy AI)."""
    exc = (hint or {}).get("exc_info")
    if exc and exc[0].__name__ in {"AIBusy", "ImageBusy"}:
        return None
    return event


def init_sentry() -> bool:
    """Start error reporting if SENTRY_DSN is set. Returns whether it was started.

    Privacy: no cookies/IP (send_default_pii off) and no request bodies, because bodies can hold
    base64 photos. HTTP errors the API raises on purpose (401, 403, 404, 429, 502 and so on) are not
    reported; only unexpected exceptions are.
    """
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        return False
    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("SENTRY_ENV", "production"),
        release=os.environ.get("RENDER_GIT_COMMIT") or None,
        send_default_pii=False,
        max_request_body_size="never",
        traces_sample_rate=0.0,
        before_send=_drop_expected,
        # Starlette/FastAPI integrations are on by default; stop them reporting handled HTTP errors.
        integrations=_integrations(),
    )
    return True


def _integrations() -> list:
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    return [
        StarletteIntegration(failed_request_status_codes=set()),
        FastApiIntegration(failed_request_status_codes=set()),
    ]
