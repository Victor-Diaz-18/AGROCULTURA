"""Seed data for the catalog: sectors, tags and the portal configuration.

Seeding only fills EMPTY collections, so running it against a database that
already has data never overwrites what the administrators changed.
"""

from __future__ import annotations

import unicodedata

from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from lib.catalog.repository import ETIQUETAS, SECTORES
from lib.config.repository import COLLECTION as CONFIG, PORTAL_ID


def _point(lon: float, lat: float) -> dict:
    return {"type": "Point", "coordinates": [lon, lat]}


# Bump this number whenever the centers below are corrected: the next start of the app moves the sectors that
# were saved with an older number (and the stories that sit "at the center of their sector") to the new points.
#   1: first (provisional) positions, copied from the layout of the illustrative map of the design.
#   2: La Tagua and San Lorenzo from Google Maps, given by the team; Minca was already right.
#   3: «Tijereras» does not exist: the fourth sector is La Tigrera (point from OpenStreetMap, confirmed by the team).
SECTORES_VERSION = 3

# Sectors whose id changed: old id -> new id. The start of the app moves the old one (and its stories) to the new id.
RENOMBRADOS = {"tijereras": "la-tigrera"}

# `centro_provisional`: the point has not been confirmed. The map does not write the name of such a sector on
# it, and the administration screen says so. Today every sector is confirmed.
SECTORES_SEED = [
    {"_id": "minca", "nombre": "Minca", "orden": 1, "centro": _point(-74.1180, 11.1400), "centro_provisional": False, "centro_version": SECTORES_VERSION},
    {"_id": "la-tagua", "nombre": "La Tagua", "orden": 2, "centro": _point(-74.044951, 11.082986), "centro_provisional": False, "centro_version": SECTORES_VERSION},
    # In Google Maps this point is named "Cuchillas San Lorenzo": a mountain ridge. To be confirmed with the families
    # whether their San Lorenzo is the settlement somewhere near it.
    {"_id": "san-lorenzo", "nombre": "San Lorenzo", "orden": 3, "centro": _point(-74.034676, 11.116315), "centro_provisional": False, "centro_version": SECTORES_VERSION},
    # The hamlet «Tigrera» in OpenStreetMap, about 4 km northwest of Minca, toward Santa Marta.
    {"_id": "la-tigrera", "nombre": "La Tigrera", "orden": 4, "centro": _point(-74.145509, 11.170484), "centro_provisional": False, "centro_version": SECTORES_VERSION},
]

ETIQUETAS_SEED = ["#café", "#finca", "#familia", "#cosecha", "#cocina", "#oficios"]

PORTAL_SEED = {
    "_id": PORTAL_ID,
    "nombre_portal": "AGROCULTURA",  # final name still to be confirmed with the professor
    "avisar_rechazo": False,  # "por definir con el profesor"
    "datos_de_ejemplo": True,  # shows "datos de ejemplo" in the header, as in the design
}


def _seed_portal(db: Database) -> int:
    """Creates the portal document if missing (by id, so other documents in the collection do not matter)."""
    values = {key: value for key, value in PORTAL_SEED.items() if key != "_id"}
    result = db[CONFIG].update_one({"_id": PORTAL_ID}, {"$setOnInsert": values}, upsert=True)
    return 1 if result.upserted_id is not None else 0


def _insert_if_empty(collection: Collection, documents: list[dict]) -> int:
    if collection.count_documents({}) > 0:
        return 0
    collection.insert_many(documents)
    return len(documents)


def seed_catalog(db: Database) -> dict[str, int]:
    """Fill sectors, tags and portal config when empty. Returns inserted counts."""
    return {
        "sectores": _insert_if_empty(db[SECTORES], [dict(s) for s in SECTORES_SEED]),
        "etiquetas": _insert_if_empty(
            db[ETIQUETAS], [{"nombre": nombre, "orden": i} for i, nombre in enumerate(ETIQUETAS_SEED, 1)]
        ),
        "configuracion": _seed_portal(db),
    }


def _plain(text: str) -> str:
    """Lowercase and without accents, as the search text of a story is kept (see lib/stories/service.search_text)."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def _rename_sectors(db: Database) -> None:
    """A sector whose id changed (RENOMBRADOS) takes its new id, and its stories go with it. It keeps its old center and
    version, so the loop below moves it (and the stories placed at it) to the new point. Safe to run twice."""
    for old_id, new_id in RENOMBRADOS.items():
        old = db[SECTORES].find_one({"_id": old_id})
        if old is None:
            continue
        if db[SECTORES].find_one({"_id": new_id}) is None:
            seed = next(sector for sector in SECTORES_SEED if sector["_id"] == new_id)
            try:
                db[SECTORES].insert_one({**old, "_id": new_id, "nombre": seed["nombre"]})
            except DuplicateKeyError:
                pass  # another instance did it
        old_name = _plain(old.get("nombre", ""))
        for story in db["historias"].find({"sector_id": old_id}, {"busqueda": 1}):
            new_name = _plain(next(sector["nombre"] for sector in SECTORES_SEED if sector["_id"] == new_id))
            db["historias"].update_one(
                {"_id": story["_id"]},
                {"$set": {"sector_id": new_id, "busqueda": (story.get("busqueda") or "").replace(old_name, new_name)}},
            )
        db[SECTORES].delete_one({"_id": old_id})


def sync_sector_centers(db: Database) -> dict[str, int]:
    """Brings the sector centers saved in the database to the ones in this file, when this file has a newer version.

    Sectors are read-only in the app (nobody edits them), so the code is the single source of their name and position.
    The stories that were placed "at their sector" (`ubicacion_origen == "sector"`, including the examples with their
    small offsets) move by the same distance as their sector; stories with a point of their own (GPS or a tap on
    the map) never move. Returns how many stories moved, by sector. Safe to run on every start and from two
    instances at once: the sector is claimed with one conditional update, so only one instance moves its stories.
    """
    _rename_sectors(db)
    moved: dict[str, int] = {}
    for seed in SECTORES_SEED:
        stored = db[SECTORES].find_one({"_id": seed["_id"]})
        if stored is None or stored.get("centro_version", 0) >= SECTORES_VERSION:
            continue
        old_lon, old_lat = stored["centro"]["coordinates"]
        new_lon, new_lat = seed["centro"]["coordinates"]
        claimed = db[SECTORES].update_one(
            {"_id": seed["_id"], "$or": [{"centro_version": {"$exists": False}}, {"centro_version": {"$lt": SECTORES_VERSION}}]},
            {
                "$set": {
                    "nombre": seed["nombre"],
                    "orden": seed["orden"],
                    "centro": seed["centro"],
                    "centro_provisional": seed["centro_provisional"],
                    "centro_version": SECTORES_VERSION,
                }
            },
        )
        if claimed.modified_count == 0:
            continue  # another instance did it
        d_lon, d_lat = new_lon - old_lon, new_lat - old_lat
        count = 0
        if d_lon or d_lat:
            for story in db["historias"].find({"sector_id": seed["_id"], "ubicacion_origen": "sector"}, {"ubicacion": 1}):
                lon, lat = story["ubicacion"]["coordinates"]
                db["historias"].update_one(
                    {"_id": story["_id"]},
                    {"$set": {"ubicacion.coordinates": [round(lon + d_lon, 6), round(lat + d_lat, 6)]}},
                )
                count += 1
        moved[seed["_id"]] = count
    return moved
