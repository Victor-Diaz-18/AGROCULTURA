"""Data access for the `historias` collection (the only place that queries it)."""

from __future__ import annotations

from pymongo import ASCENDING, DESCENDING, GEOSPHERE
from pymongo.database import Database

COLLECTION = "historias"


def collection(db: Database):
    return db[COLLECTION]


def ensure_indexes(db: Database) -> None:
    stories = collection(db)
    stories.create_index("codigo", unique=True, name="codigo_unico")
    stories.create_index([("ubicacion", GEOSPHERE)], name="ubicacion_2dsphere")
    stories.create_index(
        [("estado", ASCENDING), ("origen", ASCENDING), ("publicada_en", DESCENDING)],
        name="estado_origen_publicada",
    )
    stories.create_index([("autor_id", ASCENDING), ("creada_en", DESCENDING)], name="autor_creada")


def count(db: Database, *, estado: str | None = None, origen: str | None = None, medio: str | None = None) -> int:
    """Count stories by state, origin and/or having at least one media of a type."""
    query: dict = {}
    if estado:
        query["estado"] = estado
    if origen:
        query["origen"] = origen
    if medio:
        query["medios.tipo"] = medio
    return collection(db).count_documents(query)


def distinct_sector_ids(db: Database, *, estado: str) -> list[str]:
    return collection(db).distinct("sector_id", {"estado": estado})
