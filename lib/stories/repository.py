"""Data access for the `historias` collection (the only place that queries it)."""

from __future__ import annotations

from datetime import datetime

from pymongo import ASCENDING, DESCENDING, GEOSPHERE, ReturnDocument
from pymongo.database import Database

from lib.stories.constants import ESTADO_PAPELERA

COLLECTION = "historias"
TRASH_FIELDS = ("borrada_en", "borrada_por")  # when a story was sent to the trash, and by which administrator


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


def count_by_author(db: Database, author_ids: list | None = None) -> dict:
    """{author id: how many stories they sent}, in any state but the trash. Only the given authors when `author_ids` is
    passed."""
    match: dict = {"estado": {"$ne": ESTADO_PAPELERA}}
    if author_ids is not None:
        match["autor_id"] = {"$in": author_ids}
    pipeline = [{"$match": match}, {"$group": {"_id": "$autor_id", "n": {"$sum": 1}}}]
    return {row["_id"]: row["n"] for row in collection(db).aggregate(pipeline)}


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
    """A narrator's stories. One in the trash is not among them, as it was not when deleting meant deleting for good."""
    query = {"autor_id": author_id, "estado": {"$ne": ESTADO_PAPELERA}}
    return list(collection(db).find(query).sort("creada_en", DESCENDING))


def find_by_code(db: Database, code: str) -> dict | None:
    return collection(db).find_one({"codigo": code})


def list_for_admin(db: Database, *, estado: str | None, origen: str | None, limit: int) -> list[dict]:
    """Stories for the administrators. The review queue is oldest first; the rest, latest first. The trash has its own list."""
    query: dict = {"estado": estado or {"$ne": ESTADO_PAPELERA}}
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


def correct(db: Database, code: str, changes: dict) -> dict | None:
    """Saves the team's correction of a community story that is still waiting for review. None if it no longer waits."""
    return collection(db).find_one_and_update(
        {"codigo": code, "estado": "revision", "origen": "comunidad"},
        {"$set": changes},
        return_document=ReturnDocument.AFTER,
    )


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


def move_to_trash(db: Database, code: str, fields: dict) -> dict | None:
    """Sends one published story to the trash and returns it, or None if there is no such published story."""
    return collection(db).find_one_and_update(
        {"codigo": code, "estado": "publicada"},
        {"$set": {"estado": ESTADO_PAPELERA, **fields}},
        return_document=ReturnDocument.AFTER,
    )


def list_trash(db: Database) -> list[dict]:
    """The stories in the trash, the last one deleted first."""
    return list(collection(db).find({"estado": ESTADO_PAPELERA}).sort("borrada_en", DESCENDING))


def restore_from_trash(db: Database, code: str) -> dict | None:
    """Brings a story back from the trash, published again as it was. None if it is not in the trash."""
    return collection(db).find_one_and_update(
        {"codigo": code, "estado": ESTADO_PAPELERA},
        {"$set": {"estado": "publicada"}, "$unset": {name: "" for name in TRASH_FIELDS}},
        return_document=ReturnDocument.AFTER,
    )


def delete_from_trash(db: Database, code: str) -> dict | None:
    """Deletes one story of the trash for good and returns it (with its files, to delete them too)."""
    return collection(db).find_one_and_delete({"codigo": code, "estado": ESTADO_PAPELERA})


def delete_trashed_before(db: Database, moment: datetime) -> list[dict]:
    """Deletes for good the stories that went to the trash before `moment`, and returns them (to delete their files)."""
    expired = list(collection(db).find({"estado": ESTADO_PAPELERA, "borrada_en": {"$lt": moment}}))
    if expired:
        collection(db).delete_many({"_id": {"$in": [story["_id"] for story in expired]}, "estado": ESTADO_PAPELERA})
    return expired


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
