"""Read-only catalog of sectors and tags (sectors are not editable in v1)."""

from __future__ import annotations

import re

from pymongo.database import Database

from lib.catalog import repository
from lib.core.errors import ConflictError, InvalidDataError, NotFoundError

MAX_TAGS = 40
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
