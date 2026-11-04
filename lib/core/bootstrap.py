"""First-run initialization.

The first time the app meets a database it fills the catalog (sectors, tags and
portal options), so deploying only needs MONGODB_URI: nobody has to run the seed
by hand. A marker document makes it happen once; after that administrators are
free to remove tags without the seed bringing them back.
"""

from __future__ import annotations

import logging

from pymongo.database import Database
from pymongo.errors import BulkWriteError, DuplicateKeyError

from lib.config.repository import COLLECTION as CONFIG
from lib.seed.catalog import seed_catalog

logger = logging.getLogger(__name__)

SYSTEM_ID = "sistema"
_ready: set[tuple[int, str]] = set()


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


def ensure_initialized_once(db: Database) -> None:
    """Runs `ensure_initialized` once per process and never takes the API down."""
    key = (id(db.client), db.name)
    if key in _ready:
        return
    try:
        ensure_initialized(db)
    except Exception as exc:
        logger.error(
            "Could not initialize the catalog (%s: %s); will retry on the next request",
            type(exc).__name__,
            exc,
            exc_info=True,
        )
        return
    _ready.add(key)
