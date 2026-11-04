"""Command line seed: `python -m scripts.seed`.

Needs MONGODB_URI (from `.env` locally). It only fills empty collections.
"""

from __future__ import annotations

from lib.core.db import get_db
from lib.core.indexes import ensure_indexes
from lib.seed.catalog import seed_catalog


def main() -> None:
    db = get_db()
    ensure_indexes(db)
    for name, inserted in seed_catalog(db).items():
        print(f"{name}: {'cargado' if inserted else 'ya tenía datos, sin cambios'}")


if __name__ == "__main__":
    main()
