"""Application settings, read from environment variables.

`load_settings` is a pure function (easy to test). `get_settings` adds local
`.env` loading and caches the result for the life of the process.

Safety rule: in test mode (`APP_ENV=test`) the real `MONGODB_URI` is never read.
Tests only use `TEST_MONGODB_URI` and a database whose name ends in `_test`.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_NAME = "agrocultura"
DEFAULT_TEST_DB_NAME = "agrocultura_test"


class UnsafeTestDatabaseError(RuntimeError):
    """Test mode was asked to use something that could be the real database."""


@dataclass(frozen=True)
class Settings:
    env: str
    mongodb_uri: str | None
    mongodb_db: str
    cors_origins: tuple[str, ...] = ()

    # Sessions
    jwt_secret: str | None = None
    jwt_narrator_days: int = 30  # narrators may be offline for long: long sessions
    jwt_admin_hours: int = 8

    # Initial users created by the app (never written in the code)
    admin_user: str | None = None
    admin_password: str | None = None
    demo_narrator_name: str = "Ana Beltrán"
    demo_narrator_phone: str | None = None
    demo_narrator_pin: str | None = None

    # The "Reiniciar datos de ejemplo" button (deletes ALL stories). Off unless ALLOW_DEMO_RESET says so.
    allow_demo_reset: bool = False

    # Password hashing and failed sign-in attempts
    bcrypt_rounds: int = 12
    login_max_attempts: int = 5
    login_window_minutes: int = 15

    @property
    def is_test(self) -> bool:
        return self.env == "test"

    @property
    def is_production(self) -> bool:
        return self.env == "production"


def _split_csv(value: str | None) -> tuple[str, ...]:
    return tuple(item.strip() for item in (value or "").split(",") if item.strip())


def _text(environ: Mapping[str, str], name: str) -> str | None:
    value = (environ.get(name) or "").strip()
    return value or None


_TRUE = {"1", "true", "yes", "si", "sí", "on"}


def _flag(environ: Mapping[str, str], name: str) -> bool:
    return (environ.get(name) or "").strip().lower() in _TRUE


def load_settings(environ: Mapping[str, str]) -> Settings:
    """Build settings from a mapping of environment variables."""
    # Vercel sets VERCEL=1; treat it as production unless APP_ENV says otherwise.
    env = environ.get("APP_ENV") or ("production" if environ.get("VERCEL") else "development")

    common = {
        "env": env,
        "cors_origins": _split_csv(environ.get("CORS_ORIGINS")),
        "jwt_secret": _text(environ, "JWT_SECRET"),
        "admin_user": _text(environ, "ADMIN_USER"),
        # Not stripped: a password may legitimately start or end with a space.
        "admin_password": environ.get("ADMIN_PASSWORD") or None,
        "demo_narrator_name": _text(environ, "SEED_DEMO_NARRATOR_NAME") or "Ana Beltrán",
        "demo_narrator_phone": _text(environ, "SEED_DEMO_NARRATOR_PHONE"),
        "demo_narrator_pin": _text(environ, "SEED_DEMO_NARRATOR_PIN"),
        "allow_demo_reset": _flag(environ, "ALLOW_DEMO_RESET"),
    }

    if env == "test":
        uri = environ.get("TEST_MONGODB_URI") or None
        db_name = environ.get("TEST_MONGODB_DB") or DEFAULT_TEST_DB_NAME
        if not db_name.endswith("_test"):
            raise UnsafeTestDatabaseError(
                f"Test database name must end with '_test' (got '{db_name}')."
            )
        real_uri = environ.get("MONGODB_URI")
        if uri and real_uri and uri == real_uri:
            raise UnsafeTestDatabaseError("TEST_MONGODB_URI must not equal MONGODB_URI.")
        # Cheap hashing keeps the test suite fast.
        return Settings(mongodb_uri=uri, mongodb_db=db_name, bcrypt_rounds=4, **common)

    return Settings(
        mongodb_uri=environ.get("MONGODB_URI") or None,
        mongodb_db=environ.get("MONGODB_DB") or DEFAULT_DB_NAME,
        **common,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Settings for the running process (loads `.env` for local development)."""
    if os.environ.get("APP_ENV") != "test":
        load_dotenv(ROOT_DIR / ".env", override=False)
    return load_settings(os.environ)
