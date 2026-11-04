"""Seed data for the catalog: sectors, tags and the portal configuration.

Seeding only fills EMPTY collections, so running it against a database that
already has data never overwrites what the administrators changed.
"""

from __future__ import annotations

from pymongo.collection import Collection
from pymongo.database import Database

from lib.catalog.repository import ETIQUETAS, SECTORES
from lib.config.repository import COLLECTION as CONFIG, PORTAL_ID


def _point(lon: float, lat: float) -> dict:
    return {"type": "Point", "coordinates": [lon, lat]}


# Bump this number whenever the centers below are corrected: the next start of the app moves the sectors that
# were saved with an older number (and the stories that sit "at the center of their sector") to the new points.
#   1: first (provisional) positions, copied from the layout of the illustrative map of the design.
#   2: La Tagua and San Lorenzo from Google Maps, given by the team; Minca was already right.
SECTORES_VERSION = 2

# `centro_provisional`: the point has not been confirmed. The map does not write the name of such a sector on
# it, and the administration screen says so. Tijereras is still waiting for its real position.
SECTORES_SEED = [
    {"_id": "minca", "nombre": "Minca", "orden": 1, "centro": _point(-74.1180, 11.1400), "centro_provisional": False, "centro_version": SECTORES_VERSION},
    {"_id": "la-tagua", "nombre": "La Tagua", "orden": 2, "centro": _point(-74.044951, 11.082986), "centro_provisional": False, "centro_version": SECTORES_VERSION},
    # In Google Maps this point is named "Cuchillas San Lorenzo": a mountain ridge. To be confirmed with the families
    # whether their San Lorenzo is the settlement somewhere near it.
    {"_id": "san-lorenzo", "nombre": "San Lorenzo", "orden": 3, "centro": _point(-74.034676, 11.116315), "centro_provisional": False, "centro_version": SECTORES_VERSION},
    {"_id": "tijereras", "nombre": "Tijereras", "orden": 4, "centro": _point(-74.1108, 11.1090), "centro_provisional": True, "centro_version": SECTORES_VERSION},
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


def sync_sector_centers(db: Database) -> dict[str, int]:
    """Brings the sector centers saved in the database to the ones in this file, when this file has a newer version.

    Sectors are read-only in the app (nobody edits them), so the code is the single source of their position.
    The stories that were placed "at their sector" (`ubicacion_origen == "sector"`, including the examples with their
    small offsets) move by the same distance as their sector; stories with a point of their own (GPS or a tap on
    the map) never move. Returns how many stories moved, by sector. Safe to run on every start and from two
    instances at once: the sector is claimed with one conditional update, so only one instance moves its stories.
    """
    moved: dict[str, int] = {}
    for seed in SECTORES_SEED:
        stored = db[SECTORES].find_one({"_id": seed["_id"]})
        if stored is None or stored.get("centro_version", 0) >= SECTORES_VERSION:
            continue
        old_lon, old_lat = stored["centro"]["coordinates"]
        new_lon, new_lat = seed["centro"]["coordinates"]
        claimed = db[SECTORES].update_one(
            {"_id": seed["_id"], "$or": [{"centro_version": {"$exists": False}}, {"centro_version": {"$lt": SECTORES_VERSION}}]},
            {"$set": {"centro": seed["centro"], "centro_provisional": seed["centro_provisional"], "centro_version": SECTORES_VERSION}},
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
