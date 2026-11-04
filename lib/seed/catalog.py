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


# PROVISIONAL centers. Minca is the village center; the other three keep the
# relative layout of the illustrative map in the approved design (La Tagua east,
# San Lorenzo west, Tijereras south). They must be confirmed with the families
# of the area before real stories are published (the design says so too).
SECTORES_SEED = [
    {"_id": "minca", "nombre": "Minca", "orden": 1, "centro": _point(-74.1180, 11.1400)},
    {"_id": "la-tagua", "nombre": "La Tagua", "orden": 2, "centro": _point(-74.0868, 11.1301)},
    {"_id": "san-lorenzo", "nombre": "San Lorenzo", "orden": 3, "centro": _point(-74.1540, 11.1245)},
    {"_id": "tijereras", "nombre": "Tijereras", "orden": 4, "centro": _point(-74.1108, 11.1090)},
]

ETIQUETAS_SEED = ["#café", "#finca", "#familia", "#cosecha", "#cocina", "#oficios"]

PORTAL_SEED = {
    "_id": PORTAL_ID,
    "nombre_portal": "AGROCULTURA",  # final name still to be confirmed with the professor
    "avisar_rechazo": False,  # "por definir con el profesor"
    "datos_de_ejemplo": True,  # shows "datos de ejemplo" in the header, as in the design
}


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
        "configuracion": _insert_if_empty(db[CONFIG], [dict(PORTAL_SEED)]),
    }
