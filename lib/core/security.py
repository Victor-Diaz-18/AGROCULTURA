"""Password hashing (bcrypt) and session tokens (JWT).

Secrets (narrator PINs, the administrator password) are only ever stored as
bcrypt hashes. Sessions are signed JWTs; the role is always re-read from the
database on each request, so the token alone can never grant more access.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache

import bcrypt
import jwt

from lib.core.errors import ConfigurationError, UnauthorizedError
from lib.core.settings import Settings

MAX_SECRET_BYTES = 72  # bcrypt only looks at the first 72 bytes
MIN_JWT_SECRET_LENGTH = 32
JWT_ALGORITHM = "HS256"
ADMIN_ROLE = "administrador"


def hash_secret(plain: str, rounds: int = 12) -> str:
    raw = plain.encode("utf-8")
    if len(raw) > MAX_SECRET_BYTES:
        raise ValueError("secret is longer than 72 bytes")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds)).decode("ascii")


def verify_secret(plain: str, hashed: str) -> bool:
    raw = plain.encode("utf-8")
    if len(raw) > MAX_SECRET_BYTES:
        return False
    try:
        return bcrypt.checkpw(raw, hashed.encode("ascii"))
    except ValueError:  # malformed hash
        return False


@lru_cache(maxsize=4)
def dummy_hash(rounds: int) -> str:
    """A hash to compare against when the user does not exist, so timing does not reveal it."""
    return hash_secret("no-such-user", rounds)


def require_secret(settings: Settings) -> str:
    secret = settings.jwt_secret
    if not secret or len(secret) < MIN_JWT_SECRET_LENGTH:
        raise ConfigurationError(
            f"Falta configurar JWT_SECRET en el servidor (mínimo {MIN_JWT_SECRET_LENGTH} caracteres)."
        )
    return secret


def create_token(user: dict, settings: Settings, now: datetime | None = None) -> str:
    """Signed session token. Administrators get a short session, narrators a long one."""
    secret = require_secret(settings)
    issued = (now or datetime.now(timezone.utc)).replace(tzinfo=timezone.utc)
    if user["rol"] == ADMIN_ROLE:
        lifetime = timedelta(hours=settings.jwt_admin_hours)
    else:
        lifetime = timedelta(days=settings.jwt_narrator_days)
    claims = {
        "sub": str(user["_id"]),
        "rol": user["rol"],
        "nombre": user["nombre"],
        "iat": issued,
        "exp": issued + lifetime,
    }
    return jwt.encode(claims, secret, algorithm=JWT_ALGORITHM)


def decode_token(token: str, settings: Settings) -> dict:
    secret = require_secret(settings)
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "rol"]},
            leeway=10,
        )
    except jwt.PyJWTError:
        raise UnauthorizedError("Tu sesión no es válida o venció. Ingresa de nuevo.") from None
