"""Read-only catalog of sectors and tags (sectors are not editable in v1)."""

from __future__ import annotations

from pymongo.database import Database

from lib.catalog import repository


def list_sectors(db: Database) -> list[dict]:
    """Sectors with their center as plain latitude/longitude, in display order."""
    sectors = []
    for doc in repository.list_sectors(db):
        lon, lat = doc["centro"]["coordinates"]
        sectors.append({"id": doc["_id"], "nombre": doc["nombre"], "centro": {"lat": lat, "lon": lon}})
    return sectors


def list_tag_names(db: Database) -> list[str]:
    return [doc["nombre"] for doc in repository.list_tags(db)]
