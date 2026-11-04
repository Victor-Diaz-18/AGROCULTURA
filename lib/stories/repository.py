"""Data access for the `historias` collection (the only place that queries it)."""

from __future__ import annotations

from pymongo import ASCENDING, DESCENDING, GEOSPHERE, ReturnDocument
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
    # One story per (author, client_id): a resend of the same draft never duplicates it.
    stories.create_index(
        [("autor_id", ASCENDING), ("client_id", ASCENDING)],
        unique=True,
        partialFilterExpression={"client_id": {"$type": "string"}},
        name="autor_client_id_unico",
    )


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


COUNTERS = "contadores"


def next_code_number(db: Database, year: int) -> int:
    """The next story number of the year (atomic, so two stories never get the same code)."""
    counter = db[COUNTERS].find_one_and_update(
        {"_id": f"historias-{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return counter["seq"]


def insert(db: Database, document: dict) -> dict:
    """Inserts a story; raises DuplicateKeyError on a repeated code or (author, client_id)."""
    collection(db).insert_one(document)
    return document


def find_by_client_id(db: Database, author_id, client_id: str) -> dict | None:
    return collection(db).find_one({"autor_id": author_id, "client_id": client_id})


def list_by_author(db: Database, author_id) -> list[dict]:
    return list(collection(db).find({"autor_id": author_id}).sort("creada_en", DESCENDING))
