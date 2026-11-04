"""First-run initialization.

The first time the app meets a database it fills the catalog (sectors, tags and
portal options), so deploying only needs MONGODB_URI: nobody has to run the seed
by hand. A marker document makes it happen once; after that administrators are
free to remove tags without the seed bringing them back.

The initial users (administrator, optional demo narrator) come from environment
variables and are checked once per process: changing ADMIN_PASSWORD and
redeploying updates the administrator password.
"""

from __future__ import annotations

import logging
from collections.abc import Callable

from pymongo.database import Database
from pymongo.errors import BulkWriteError, DuplicateKeyError

from lib.auth import service as auth_service
from lib.config.repository import COLLECTION as CONFIG
from lib.core.settings import get_settings
from lib.seed.catalog import seed_catalog, sync_sector_centers

logger = logging.getLogger(__name__)

SYSTEM_ID = "sistema"
_ready: set[tuple[int, str]] = set()  # catalog initialized in this process
_users_ready: set[tuple[int, str]] = set()  # initial users checked in this process
_centers_ready: set[tuple[int, str]] = set()  # sector centers checked in this process


def ensure_initialized(db: Database) -> bool:
    """Seeds the catalog once. Returns True when it did the seeding now."""
    state = db[CONFIG].find_one({"_id": SYSTEM_ID})
    if state and state.get("catalogo_inicializado"):
        return False
    try:
        seed_catalog(db)  # only fills what is empty, never overwrites
    except (DuplicateKeyError, BulkWriteError):
        pass  # another instance seeded at the same moment; the catalog is there
    db[CONFIG].update_one({"_id": SYSTEM_ID}, {"$set": {"catalogo_inicializado": True}}, upsert=True)
    return True


def _run_once(ready: set, db: Database, step: Callable[[Database], object], what: str) -> None:
    key = (id(db.client), db.name)
    if key in ready:
        return
    try:
        step(db)
    except Exception as exc:  # never take the API down because of a setup problem
        logger.error(
            "Could not initialize %s (%s: %s); will retry on the next request",
            what,
            type(exc).__name__,
            exc,
            exc_info=True,
        )
        return
    ready.add(key)


def ensure_initialized_once(db: Database) -> None:
    """Runs the first-run steps once per process and never takes the API down."""
    _run_once(_ready, db, lambda database: ensure_initialized(database), "the catalog")
    _run_once(
        _users_ready,
        db,
        lambda database: auth_service.ensure_initial_users(database, get_settings()),
        "the initial users",
    )
    _run_once(_centers_ready, db, lambda database: sync_sector_centers(database), "the sector centers")
