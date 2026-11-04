"""Shared fixtures for the backend tests.

Safety: tests NEVER touch the real database.
 - `APP_ENV=test` is set before the app is imported, which makes the settings
   ignore `MONGODB_URI` and require a database name ending in `_test`.
 - By default an in-memory fake (mongomock) is used: no setup needed.
 - Set TEST_MONGODB_URI to also run the `real_mongo` tests (geospatial queries)
   against a real MongoDB; only the `*_test` database is ever used and wiped.
"""

from __future__ import annotations

import os

# Must happen before anything imports the application settings.
os.environ["APP_ENV"] = "test"
# Fixed test credentials: never depend on (or leak) whatever the developer has exported.
os.environ["JWT_SECRET"] = "test-only-jwt-secret-with-more-than-32-characters"
os.environ["ADMIN_USER"] = "admin-prueba"
os.environ["ADMIN_PASSWORD"] = "clave-de-prueba-1234"
os.environ.pop("SEED_DEMO_NARRATOR_PHONE", None)
os.environ.pop("SEED_DEMO_NARRATOR_PIN", None)
os.environ.pop("ALLOW_DEMO_RESET", None)

import mongomock  # noqa: E402
import pymongo  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from api.index import create_app  # noqa: E402
from lib.auth.service import ensure_admin  # noqa: E402
from lib.core.db import get_db  # noqa: E402
from lib.core.indexes import ensure_indexes  # noqa: E402
from lib.core.settings import get_settings  # noqa: E402
from lib.media.storage import get_storage  # noqa: E402
from lib.seed.catalog import seed_catalog  # noqa: E402

HAS_REAL_MONGO = bool(os.environ.get("TEST_MONGODB_URI"))


def pytest_collection_modifyitems(config, items):
    if HAS_REAL_MONGO:
        return
    skip = pytest.mark.skip(reason="needs a real MongoDB: set TEST_MONGODB_URI")
    for item in items:
        if "real_mongo" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope="session")
def mongo_client():
    settings = get_settings()
    assert settings.is_test and settings.mongodb_db.endswith("_test")
    if HAS_REAL_MONGO:
        client = pymongo.MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    else:
        client = mongomock.MongoClient()
    yield client
    if HAS_REAL_MONGO:
        client.drop_database(settings.mongodb_db)
    client.close()


@pytest.fixture
def db(mongo_client):
    """A clean test database for each test."""
    database = mongo_client[get_settings().mongodb_db]
    assert database.name.endswith("_test"), "refusing to use a non-test database"
    for name in database.list_collection_names():
        database[name].delete_many({})
    ensure_indexes(database)
    seed_catalog(database)  # sectors, tags and portal config, like a fresh install
    return database


class FakeStorage:
    """Stands in for Vercel Blob: remembers what was saved and answers a URL shaped like a real one."""

    def __init__(self):
        self.saved = []
        self.deleted = []

    def delete(self, urls):
        self.deleted.extend(urls)
        return len(urls)

    def save(self, pathname, content, content_type):
        self.saved.append({"pathname": pathname, "bytes": len(content), "content_type": content_type})
        stem, dot, extension = pathname.rpartition(".")
        return f"https://store123.public.blob.vercel-storage.com/{stem}-Zx81Qa{dot}{extension}"


@pytest.fixture
def storage():
    return FakeStorage()


@pytest.fixture
def app(db, storage):
    application = create_app()
    application.dependency_overrides[get_db] = lambda: db
    application.dependency_overrides[get_storage] = lambda: storage
    return application


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def settings():
    return get_settings()


# ---- people ---------------------------------------------------------------

NARRATOR = {"nombre": "Ana Beltrán", "celular": "300 555 0192", "pin": "4821"}


def register(client, **overrides):
    return client.post("/api/auth/registro", json={**NARRATOR, **overrides})


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def narrator(client):
    """A registered narrator: {"token", "usuario", "headers"}."""
    session = register(client).json()
    return {**session, "headers": bearer(session["token"])}


@pytest.fixture
def admin(client, db, settings):
    """The initial administrator, signed in: {"token", "usuario", "headers"}."""
    ensure_admin(db, settings)
    response = client.post(
        "/api/auth/ingreso",
        json={"rol": "administrador", "usuario": settings.admin_user, "clave": settings.admin_password},
    )
    session = response.json()
    return {**session, "headers": bearer(session["token"])}
