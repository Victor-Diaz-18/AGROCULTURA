"""Data access for `usuarios` and `intentos_ingreso` (failed sign-in counters)."""

from __future__ import annotations

from datetime import datetime, timedelta

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from lib.auth.constants import ROL_ADMIN

USUARIOS = "usuarios"
INTENTOS = "intentos_ingreso"


def ensure_indexes(db: Database) -> None:
    db[USUARIOS].create_index("usuario", unique=True, name="usuario_unico")
    # Attempt counters clean themselves up.
    db[INTENTOS].create_index("expira_en", expireAfterSeconds=0, name="intentos_ttl")


def find_by_usuario(db: Database, usuario: str, rol: str | None = None) -> dict | None:
    query: dict = {"usuario": usuario}
    if rol:
        query["rol"] = rol
    return db[USUARIOS].find_one(query)


def find_by_id(db: Database, user_id: str) -> dict | None:
    try:
        return db[USUARIOS].find_one({"_id": ObjectId(user_id)})
    except (InvalidId, TypeError):
        return None


def insert_user(db: Database, document: dict) -> dict:
    """Inserts a user; raises DuplicateKeyError if `usuario` is taken."""
    db[USUARIOS].insert_one(document)  # fills document["_id"]
    return document


def update_secret_hash(db: Database, user_id: ObjectId, secret_hash: str) -> None:
    db[USUARIOS].update_one({"_id": user_id}, {"$set": {"clave_hash": secret_hash}})


def list_admins(db: Database) -> list[dict]:
    return list(db[USUARIOS].find({"rol": ROL_ADMIN}).sort("creado_en", 1))


def set_active(db: Database, user_id: ObjectId, fields: dict, unset: tuple[str, ...] = ()) -> dict:
    """Changes `activo` (and the record of who did it) and returns the updated user."""
    update: dict = {"$set": fields}
    if unset:
        update["$unset"] = {name: "" for name in unset}
    return db[USUARIOS].find_one_and_update({"_id": user_id}, update, return_document=ReturnDocument.AFTER)


def mark_login(db: Database, user_id: ObjectId, now: datetime) -> None:
    db[USUARIOS].update_one({"_id": user_id}, {"$set": {"ultimo_ingreso": now}})


def register_attempt(db: Database, key: str, now: datetime, window: timedelta) -> dict:
    """Counts one sign-in attempt for `key` inside a fixed window and returns the counter.

    The increment is atomic, so parallel guesses cannot slip past the limit: every
    attempt is counted BEFORE the credentials are checked.
    """
    attempts = db[INTENTOS]
    attempts.delete_one({"_id": key, "desde": {"$lte": now - window}})  # the window ended
    update = {
        "$inc": {"intentos": 1},
        "$setOnInsert": {"desde": now, "expira_en": now + window + timedelta(hours=1)},
    }
    for _ in range(2):  # two concurrent first attempts can collide on the upsert
        try:
            return attempts.find_one_and_update(
                {"_id": key}, update, upsert=True, return_document=ReturnDocument.AFTER
            )
        except DuplicateKeyError:
            continue
    return attempts.find_one_and_update({"_id": key}, update, return_document=ReturnDocument.AFTER)


def clear_attempts(db: Database, key: str) -> None:
    db[INTENTOS].delete_one({"_id": key})
