"""Data access for `configuracion`: a single document with the portal options."""

from __future__ import annotations

from pymongo.database import Database

COLLECTION = "configuracion"
PORTAL_ID = "portal"

# Used when the document does not exist yet (for example before the first seed).
DEFAULT_PORTAL = {
    "nombre_portal": "AGROCULTURA",
    "avisar_rechazo": False,  # "por definir con el profesor"
    "datos_de_ejemplo": False,
}


def get_portal(db: Database) -> dict:
    doc = db[COLLECTION].find_one({"_id": PORTAL_ID}) or {}
    return {**DEFAULT_PORTAL, **{k: v for k, v in doc.items() if k in DEFAULT_PORTAL}}


def update_portal(db: Database, changes: dict) -> dict:
    """Changes only the options given (an upsert: the document may not exist yet)."""
    allowed = {key: value for key, value in changes.items() if key in DEFAULT_PORTAL}
    if allowed:
        db[COLLECTION].update_one({"_id": PORTAL_ID}, {"$set": allowed}, upsert=True)
    return get_portal(db)
