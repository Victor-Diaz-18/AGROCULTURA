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
    """The sectors that have stories on the map. A story in "another place of the zone" has no sector, and a story published
    without a place keeps its sector (if any) as a reference only the administrators read: it does not count, so the
    public counter cannot give it away."""
    return collection(db).distinct(
        "sector_id", {"estado": estado, "sector_id": {"$ne": None}, "ubicacion_modo": {"$ne": "ninguna"}}
    )


def count_without_location(db: Database, *, estado: str) -> int:
    """Stories that have no place on the map."""
    return collection(db).count_documents({"estado": estado, "ubicacion_modo": "ninguna"})


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


def find_by_code(db: Database, code: str) -> dict | None:
    return collection(db).find_one({"codigo": code})


def list_for_admin(db: Database, *, estado: str | None, origen: str | None, limit: int) -> list[dict]:
    """Stories for the administrators. The review queue is oldest first; the rest, latest first."""
    query: dict = {}
    if estado:
        query["estado"] = estado
    if origen:
        query["origen"] = origen
    order = [("enviada_en", ASCENDING)] if estado == "revision" else [("creada_en", DESCENDING)]
    return list(collection(db).find(query).sort(order).limit(limit))


def decide(db: Database, code: str, changes: dict, *, needs_consent: bool = False) -> dict | None:
    """Moves a community story out of review, once. Returns it, or None if it was not waiting for review.

    The state is part of the filter, so two administrators deciding at the same moment
    cannot both succeed: the second one finds nothing in review. With `needs_consent`, a story that carries no record of its
    narrator's authorization is not found either (it can be rejected, never published).
    """
    query: dict = {"codigo": code, "estado": "revision", "origen": "comunidad"}
    if needs_consent:
        query["consentimiento.aceptado_en"] = {"$exists": True}
    return collection(db).find_one_and_update(query, {"$set": changes}, return_document=ReturnDocument.AFTER)


def add_video(db: Database, story_id, medio: dict) -> dict | None:
    """Adds the video to a story that is in review and has none. None when it did not apply (it has one, or was reviewed).

    Both conditions are part of the filter, so two sends of different videos cannot both succeed.
    """
    return collection(db).find_one_and_update(
        {"_id": story_id, "estado": "revision", "medios.tipo": {"$ne": "video"}},
        {"$push": {"medios": medio}},
        return_document=ReturnDocument.AFTER,
    )


def media_urls(db: Database) -> list[str]:
    """Every file the stories point to (used when all of them are deleted)."""
    urls: list[str] = []
    for story in collection(db).find({"medios.url": {"$type": "string"}}, {"medios": 1}):
        urls.extend(medio["url"] for medio in story.get("medios", []) if isinstance(medio.get("url"), str))
    return urls


def delete_all(db: Database) -> int:
    """Deletes EVERY story and the code counters. Only the demo reset calls this."""
    deleted = collection(db).delete_many({}).deleted_count
    db[COUNTERS].delete_many({"_id": {"$regex": "^historias-"}})
    return deleted


def set_counter(db: Database, year: int, value: int) -> None:
    db[COUNTERS].update_one({"_id": f"historias-{year}"}, {"$set": {"seq": value}}, upsert=True)


def insert_many(db: Database, documents: list[dict]) -> None:
    if documents:
        collection(db).insert_many(documents)


MAX_PUBLISHED = 1000


def list_published(db: Database, limit: int) -> list[dict]:
    """Published stories, newest first (the ones the map shows)."""
    return list(
        collection(db)
        .find({"estado": "publicada"})
        .sort([("publicada_en", DESCENDING), ("codigo", DESCENDING)])
        .limit(limit)
    )


def find_published(db: Database, code: str) -> dict | None:
    """A story by code, only if it is published: nobody else's drafts or rejected stories are reachable."""
    return collection(db).find_one({"codigo": code, "estado": "publicada"})
