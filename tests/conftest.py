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

import mongomock  # noqa: E402
import pymongo  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from api.index import create_app  # noqa: E402
from lib.core.db import get_db  # noqa: E402
from lib.core.settings import get_settings  # noqa: E402

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
    return database


@pytest.fixture
def app(db):
    application = create_app()
    application.dependency_overrides[get_db] = lambda: db
    return application


@pytest.fixture
def client(app):
    return TestClient(app)
