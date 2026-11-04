"""Business rules for stories."""

from __future__ import annotations

from pymongo.database import Database

from lib.catalog import service as catalog
from lib.stories import repository
from lib.stories.constants import ORIGENES, TIPOS_MEDIO


def get_stats(db: Database) -> dict:
    """Counters shown in the header, the map cards and the admin summary."""
    por_origen = {origen: repository.count(db, estado="publicada", origen=origen) for origen in ORIGENES}
    return {
        "publicadas": repository.count(db, estado="publicada"),
        "en_revision": repository.count(db, estado="revision"),
        "rechazadas": repository.count(db, estado="rechazada"),
        "aprobadas_comunidad": por_origen["comunidad"],
        "por_origen": por_origen,
        "sectores_con_historias": len(repository.distinct_sector_ids(db, estado="publicada")),
        "total_sectores": len(catalog.list_sectors(db)),
        "formatos": {
            tipo: repository.count(db, estado="publicada", medio=tipo) for tipo in TIPOS_MEDIO
        },
    }
