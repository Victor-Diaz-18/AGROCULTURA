"""MongoDB access.

The client is a module-level global so warm serverless invocations reuse the
same connection pool instead of reconnecting on every request.
"""

from __future__ import annotations

from pymongo import MongoClient
from pymongo.database import Database

from lib.core.errors import DatabaseUnavailableError
from lib.core.settings import get_settings

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.mongodb_uri:
            raise DatabaseUnavailableError(
                "La base de datos no está configurada. Falta la variable MONGODB_URI."
            )
        # Small pool: every serverless instance keeps its own, and Atlas M0
        # allows a limited number of simultaneous connections.
        _client = MongoClient(
            settings.mongodb_uri,
            maxPoolSize=5,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            appname="agrocultura",
        )
    return _client


def get_db() -> Database:
    """FastAPI dependency returning the application database."""
    from lib.core.indexes import ensure_indexes_once  # local import avoids a cycle

    db = get_client()[get_settings().mongodb_db]
    ensure_indexes_once(db)
    return db
