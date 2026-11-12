import hmac
import logging
import os
import re
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.auth import bearer, current_user_id

router = APIRouter(prefix="/api/payments", tags=["payments"])
log = logging.getLogger(__name__)

MONOBANK_STATEMENT_URL = "https://api.monobank.ua/personal/statement"
PERIODS = (1, 3, 6, 12)

# Cyrillic letters that look like the Latin ones in an order code, in case the buyer typed it by hand
LOOKALIKES = str.maketrans("АВЕКМНОРСТХ", "ABEKMHOPCTX")
CODE_RE = re.compile(r"M\s*L[\s\-_.]*([A-HJKMNP-Z2-9]{6})")


def shared_secret() -> str:
    return os.environ.get("PAYMENTS_SECRET", "")


def card_number() -> str:
    return os.environ.get("PAYMENT_CARD", "").strip()


def extract_code(comment: str) -> str | None:
    """The order code (ML-XXXXXX) from a payment comment, however it was typed."""
    match = CODE_RE.search((comment or "").upper().translate(LOOKALIKES))
    return f"ML-{match.group(1)}" if match else None


def _rest(path: str) -> str:
    return os.environ["SUPABASE_URL"].strip().rstrip("/.") + "/rest/v1/" + path


class SupabasePaymentStore:
    """Calls the payment functions as the signed-in user; the database does all the checks."""

    def __init__(self, token: str):
        self.headers = {"apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"], "Authorization": f"Bearer {token}"}

    def _rpc(self, name: str, payload: dict | None = None):
        r = httpx.post(_rest("rpc/" + name), headers=self.headers, json=payload or {}, timeout=20)
        r.raise_for_status()
        return r.json()

    def prices(self) -> dict[int, int]:
        r = httpx.get(_rest("premium_prices?select=months,amount_uah"), headers=self.headers, timeout=20)
        r.raise_for_status()
        return {row["months"]: row["amount_uah"] for row in r.json()}

    def create_order(self, months: int) -> dict:
        return self._rpc("create_payment_order", {"order_months": months})

    def my_orders(self) -> list[dict]:
        return self._rpc("my_payment_orders")

    def cancel_order(self, code: str) -> dict:
        return self._rpc("cancel_payment_order", {"order_code": code})


def get_store(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> SupabasePaymentStore:
    return SupabasePaymentStore(creds.credentials)


class SupabaseConfirmStore:
    """The bank calls us, so nobody is signed in: the database checks the shared secret instead."""

    def confirm(self, code: str, tx_id: str, kopecks: int) -> dict:
        headers = {"apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"]}
        payload = {"shared_secret": shared_secret(), "order_code": code, "tx_id": tx_id, "paid_kopecks": kopecks}
        r = httpx.post(_rest("rpc/confirm_card_payment"), headers=headers, json=payload, timeout=20)
        if r.status_code in (401, 403):
            raise PermissionError("the database refused the shared secret")
        r.raise_for_status()
        return r.json()


def get_confirm_store() -> SupabaseConfirmStore:
    return SupabaseConfirmStore()


class RateLimited(Exception):
    pass


_last_statement_call = 0.0


def find_in_statement(account: str, tx_id: str) -> dict | None:
    """The payment as the bank itself reports it (the webhook has no signature, so it is not trusted)."""
    global _last_statement_call
    now = int(time.time())
    r = httpx.get(
        f"{MONOBANK_STATEMENT_URL}/{account or '0'}/{now - 6 * 3600}/{now}",
        headers={"X-Token": os.environ["MONOBANK_TOKEN"]},
        timeout=20,
    )
    if r.status_code == 429:
        raise RateLimited
    r.raise_for_status()
    return next((item for item in r.json() if item.get("id") == tx_id), None)


class PricesOut(BaseModel):
    enabled: bool
    card: str
    prices: dict[int, int]


@router.get("/info", response_model=PricesOut)
def info(_: str = Depends(current_user_id), store: SupabasePaymentStore = Depends(get_store)):
    """Where to send the money and the prices; `enabled` is false until the card and the secret are set."""
    try:
        prices = store.prices()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not load the prices")
    return PricesOut(enabled=bool(card_number() and shared_secret()), card=card_number(), prices=prices)


class OrderIn(BaseModel):
    months: int


@router.post("/orders", status_code=201)
def create_order(
    body: OrderIn,
    _: str = Depends(current_user_id),
    store: SupabasePaymentStore = Depends(get_store),
):
    if not (card_number() and shared_secret()):
        raise HTTPException(status_code=503, detail="payments_not_configured")
    if body.months not in PERIODS:
        raise HTTPException(status_code=422, detail="bad_period")
    try:
        result = store.create_order(body.months)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not create the order, try again")
    if not result.get("ok"):
        raise HTTPException(status_code=422, detail=result.get("error", "failed"))
    return result


@router.get("/orders")
def my_orders(_: str = Depends(current_user_id), store: SupabasePaymentStore = Depends(get_store)):
    try:
        return store.my_orders()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not load the orders")


@router.delete("/orders/{code}", status_code=204)
def cancel_order(code: str, _: str = Depends(current_user_id), store: SupabasePaymentStore = Depends(get_store)):
    try:
        result = store.cancel_order(code)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not cancel the order")
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail="Not Found")


def _check_path_secret(secret: str) -> None:
    expected = shared_secret()
    if not expected or not hmac.compare_digest(secret.encode(), expected.encode()):
        raise HTTPException(status_code=404, detail="Not Found")


@router.get("/monobank/{secret}")
def monobank_check(secret: str):
    """monobank opens this address with GET when the webhook is registered and expects 200."""
    _check_path_secret(secret)
    return {"ok": True}


@router.post("/monobank/{secret}")
def monobank_webhook(secret: str, body: dict, store: SupabaseConfirmStore = Depends(get_confirm_store)):
    _check_path_secret(secret)
    if body.get("type") != "StatementItem":
        return {"ok": True, "ignored": True}
    data = body.get("data") or {}
    item = data.get("statementItem") or {}
    tx_id = str(item.get("id") or "")
    if not tx_id or int(item.get("amount") or 0) <= 0:
        return {"ok": True, "ignored": True}  # not an incoming payment

    if os.environ.get("MONOBANK_TOKEN"):
        try:
            item = find_in_statement(str(data.get("account") or ""), tx_id)
        except RateLimited:
            raise HTTPException(status_code=503, detail="try again")  # the bank sends it again
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Could not check the payment")
        if not item:
            log.warning("payment %s is not in the bank statement, ignored", tx_id)
            return {"ok": True, "verified": False}

    code = extract_code(str(item.get("comment") or ""))
    if not code:
        return {"ok": True, "matched": False}  # an admin can confirm it by hand
    try:
        result = store.confirm(code, tx_id, int(item.get("amount") or 0))
    except PermissionError:
        log.error("PAYMENTS_SECRET does not match the one stored in the database")
        raise HTTPException(status_code=503, detail="payments_not_configured")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not apply the payment")
    if not result.get("ok"):
        log.info("payment %s for %s not applied: %s", tx_id, code, result.get("error"))
    return {"ok": True, "matched": bool(result.get("ok")), "error": result.get("error")}
