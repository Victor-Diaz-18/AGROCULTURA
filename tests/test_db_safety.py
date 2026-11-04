"""The test suite must never be able to reach the real database."""

import pytest

from lib.core.settings import UnsafeTestDatabaseError, load_settings

REAL_URI = "mongodb+srv://user:secret@real-cluster.mongodb.net"


def test_test_mode_ignores_the_real_connection_string():
    settings = load_settings({"APP_ENV": "test", "MONGODB_URI": REAL_URI, "MONGODB_DB": "agrocultura"})

    assert settings.mongodb_uri is None
    assert settings.mongodb_db == "agrocultura_test"


def test_test_mode_refuses_a_database_name_without_the_test_suffix():
    with pytest.raises(UnsafeTestDatabaseError):
        load_settings({"APP_ENV": "test", "TEST_MONGODB_DB": "agrocultura"})


def test_test_mode_refuses_a_test_uri_equal_to_the_real_one():
    with pytest.raises(UnsafeTestDatabaseError):
        load_settings({"APP_ENV": "test", "TEST_MONGODB_URI": REAL_URI, "MONGODB_URI": REAL_URI})


def test_test_mode_accepts_a_separate_test_database():
    settings = load_settings(
        {"APP_ENV": "test", "TEST_MONGODB_URI": "mongodb://localhost:27017", "MONGODB_URI": REAL_URI}
    )

    assert settings.mongodb_uri == "mongodb://localhost:27017"
    assert settings.mongodb_db.endswith("_test")


def test_normal_mode_reads_the_real_settings():
    settings = load_settings({"APP_ENV": "development", "MONGODB_URI": REAL_URI, "MONGODB_DB": "agro"})

    assert settings.mongodb_uri == REAL_URI
    assert settings.mongodb_db == "agro"


def test_vercel_defaults_to_production():
    assert load_settings({"VERCEL": "1"}).is_production


def test_the_active_test_session_uses_a_test_database(db):
    assert db.name.endswith("_test")
