"""Read-only catalog of sectors and tags (sectors are not editable in v1)."""

from __future__ import annotations

import re

from pymongo.database import Database

from lib.catalog import repository
from lib.core.errors import ConflictError, InvalidDataError, NotFoundError
from lib.core.geo import distance_km

MAX_TAGS = 40

# A story can be anywhere in the zone (Minca and the places around it). The sectors are only references: a story
# belongs to a sector when its point is within this distance of the sector's center, and to none otherwise.
# Keep it equal to SECTOR_RADIUS_KM in src/config/map.js (the form shows the same answer before sending).
SECTOR_RADIUS_KM = 3.0
_TAG = re.compile(r"#[\w-]{1,29}")


def list_sectors(db: Database) -> list[dict]:
    """Sectors with their center as plain latitude/longitude, in display order."""
    sectors = []
    for doc in repository.list_sectors(db):
        lon, lat = doc["centro"]["coordinates"]
        sectors.append(
            {
                "id": doc["_id"],
                "nombre": doc["nombre"],
                "centro": {"lat": lat, "lon": lon},
                "provisional": bool(doc.get("centro_provisional")),
            }
        )
    return sectors


def list_tag_names(db: Database) -> list[str]:
    return [doc["nombre"] for doc in repository.list_tags(db)]


def get_sector(db: Database, sector_id: str) -> dict | None:
    """The sector as stored (GeoJSON center included), or None if it does not exist."""
    return repository.get_sector(db, sector_id)


def normalize_tag(raw: str) -> str:
    """"Café viejo" -> "#café-viejo": lowercase, hyphens for spaces, always starting with "#"."""
    name = re.sub(r"\s+", "-", (raw or "").strip().lower())
    name = name if name.startswith("#") else f"#{name}"
    if not _TAG.fullmatch(name):
        raise InvalidDataError("La etiqueta debe tener entre 1 y 29 letras o números, sin símbolos (por ejemplo #cosecha).")
    return name


def add_tag(db: Database, raw: str) -> list[str]:
    """Adds a tag the narrators can choose. Returns the whole list."""
    name = normalize_tag(raw)
    if len(repository.list_tags(db)) >= MAX_TAGS:
        raise InvalidDataError(f"Ya hay {MAX_TAGS} etiquetas. Quita alguna antes de agregar otra.")
    if not repository.add_tag(db, name):
        raise ConflictError(f"La etiqueta {name} ya existe.")
    return list_tag_names(db)


def remove_tag(db: Database, raw: str) -> list[str]:
    """Removes a tag from the choices. Stories that already have it keep it."""
    if not repository.remove_tag(db, (raw or "").strip()):
        raise NotFoundError("Esa etiqueta ya no está en la lista.")
    return list_tag_names(db)


def sector_at(db: Database, lat: float, lon: float, *, include_provisional: bool = False) -> dict | None:
    """The sector a point belongs to (the nearest within SECTOR_RADIUS_KM), or None for "another place of the zone".

    A sector whose point is not confirmed only counts when `include_provisional` is set (someone chose that very
    sector), so a wrong provisional point never labels the stories around it.
    """
    best, best_distance = None, SECTOR_RADIUS_KM
    for sector in repository.list_sectors(db):
        if sector.get("centro_provisional") and not include_provisional:
            continue
        sector_lon, sector_lat = sector["centro"]["coordinates"]
        distance = distance_km(lat, lon, sector_lat, sector_lon)
        if distance <= best_distance:
            best, best_distance = sector, distance
    return best
