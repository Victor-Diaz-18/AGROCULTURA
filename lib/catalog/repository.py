"""Data access for the catalog collections: `sectores` and `etiquetas`."""

from __future__ import annotations

from pymongo.database import Database

SECTORES = "sectores"
ETIQUETAS = "etiquetas"


def ensure_indexes(db: Database) -> None:
    db[SECTORES].create_index("orden", name="orden")
    db[ETIQUETAS].create_index("nombre", unique=True, name="nombre_unico")


def list_sectors(db: Database) -> list[dict]:
    return list(db[SECTORES].find().sort("orden", 1))


def list_tags(db: Database) -> list[dict]:
    return list(db[ETIQUETAS].find().sort("orden", 1))
