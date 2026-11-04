"""Creates the MongoDB indexes once per process.

Each module owns its indexes (`repository.ensure_indexes`). Creating an
existing index is a no-op, so this is safe on every cold start.
"""

from __future__ import annotations

import logging

from pymongo.database import Database

logger = logging.getLogger(__name__)
_ready: set[tuple[int, str]] = set()


def ensure_indexes(db: Database) -> None:
    from lib.auth import repository as auth
    from lib.catalog import repository as catalog
    from lib.stories import repository as stories

    auth.ensure_indexes(db)
    catalog.ensure_indexes(db)
    stories.ensure_indexes(db)


def ensure_indexes_once(db: Database) -> None:
    key = (id(db.client), db.name)
    if key in _ready:
        return
    try:
        ensure_indexes(db)
    except Exception as exc:  # never take the API down because of an index problem
        # The one-line summary goes first: platform logs truncate the end of long tracebacks.
        logger.error(
            "Could not create indexes (%s: %s); will retry on the next request",
            type(exc).__name__,
            exc,
            exc_info=True,
        )
        return
    _ready.add(key)
