from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from .config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)
DEMO_USER_ID = "demo-user"


@dataclass
class User:
    id: str
    email: str | None = None


@lru_cache
def _jwks(url: str) -> PyJWKClient:
    return PyJWKClient(f"{url.rstrip('/')}/auth/v1/.well-known/jwks.json")


def decode_token(token: str, settings: Settings) -> dict:
    """Verify a Supabase access token. New projects sign with an asymmetric key
    (published as JWKS); legacy projects sign with the shared HS256 secret."""
    alg = jwt.get_unverified_header(token).get("alg")
    if alg == "HS256" and settings.supabase_jwt_secret:
        return jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
    if alg in ("ES256", "RS256") and settings.supabase_url:
        key = _jwks(settings.supabase_url).get_signing_key_from_jwt(token).key
        return jwt.decode(token, key, algorithms=[alg], audience="authenticated")
    raise jwt.InvalidAlgorithmError(f"unsupported or unconfigured token algorithm: {alg}")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> User:
    if not settings.auth_enabled:
        return User(id=DEMO_USER_ID, email="demo@localhost")
    if creds is None:
        raise HTTPException(401, "Missing bearer token")
    try:
        claims = decode_token(creds.credentials, settings)
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token") from None
    return User(id=claims["sub"], email=claims.get("email"))
