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

    @property
    def is_test(self) -> bool:
        return self.env == "test"

    @property
    def is_production(self) -> bool:
        return self.env == "production"


def _split_csv(value: str | None) -> tuple[str, ...]:
    return tuple(item.strip() for item in (value or "").split(",") if item.strip())


def load_settings(environ: Mapping[str, str]) -> Settings:
    """Build settings from a mapping of environment variables."""
    # Vercel sets VERCEL=1; treat it as production unless APP_ENV says otherwise.
    env = environ.get("APP_ENV") or ("production" if environ.get("VERCEL") else "development")
    cors_origins = _split_csv(environ.get("CORS_ORIGINS"))

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
        return Settings(env=env, mongodb_uri=uri, mongodb_db=db_name, cors_origins=cors_origins)

    return Settings(
        env=env,
        mongodb_uri=environ.get("MONGODB_URI") or None,
        mongodb_db=environ.get("MONGODB_DB") or DEFAULT_DB_NAME,
        cors_origins=cors_origins,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Settings for the running process (loads `.env` for local development)."""
    if os.environ.get("APP_ENV") != "test":
        load_dotenv(ROOT_DIR / ".env", override=False)
    return load_settings(os.environ)
