"""The real API on a throwaway in-memory database, for the end-to-end tour. Needs no MongoDB, Blob or accounts.

It is the same FastAPI app the site runs, with two swaps: the database is mongomock and the files go to a list in memory.
It starts with the twelve example stories and one administrator. Run it with:  python e2e/server.py
"""

import os
import sys
from pathlib import Path

PORT = int(os.environ.get("E2E_API_PORT", "8010"))

# The settings the tour signs in with (never real ones: this database dies with the process).
os.environ.update(
    APP_ENV="test",
    JWT_SECRET="e2e-only-jwt-secret-with-more-than-32-characters",
    ADMIN_USER="admin",
    ADMIN_PASSWORD="clave-de-prueba-123",
    ALLOW_DEMO_RESET="true",
)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import mongomock  # noqa: E402
import uvicorn  # noqa: E402

from api.index import create_app  # noqa: E402
from lib.auth.service import ensure_initial_users  # noqa: E402
from lib.core.db import get_db  # noqa: E402
from lib.core.indexes import ensure_indexes  # noqa: E402
from lib.core.settings import get_settings  # noqa: E402
from lib.media.storage import get_storage  # noqa: E402
from lib.seed.catalog import seed_catalog  # noqa: E402
from lib.seed.demo import reset_demo_data  # noqa: E402


class MemoryStorage:
    """Stands in for Vercel Blob: keeps nothing, answers with an address like the real one."""

    def save(self, pathname, content, content_type):
        stem, dot, ext = pathname.rpartition(".")
        return f"https://e2e.public.blob.vercel-storage.com/{stem}-e2e{dot}{ext}"

    def delete(self, urls):
        return len(urls)


db = mongomock.MongoClient()["agrocultura_e2e_test"]
ensure_indexes(db)
seed_catalog(db)
settings = get_settings()
ensure_initial_users(db, settings)
reset_demo_data(db, settings, MemoryStorage())

app = create_app()
app.dependency_overrides[get_db] = lambda: db
app.dependency_overrides[get_storage] = lambda: MemoryStorage()

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
