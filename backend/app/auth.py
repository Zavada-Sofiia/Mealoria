import os

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer = HTTPBearer()


def _supabase_url() -> str:
    return os.environ["SUPABASE_URL"].rstrip("/")


def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{_supabase_url()}/auth/v1/.well-known/jwks.json")


_client: jwt.PyJWKClient | None = None


def current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> str:
    global _client
    if _client is None:
        _client = _jwks_client()
    try:
        key = _client.get_signing_key_from_jwt(creds.credentials)
        claims = jwt.decode(
            creds.credentials,
            key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{_supabase_url()}/auth/v1",
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return claims["sub"]
