"""Public configuration served to the frontend."""

from __future__ import annotations

from pymongo.database import Database

from lib.catalog import service as catalog
from lib.config import repository
from lib.stories.constants import EPOCAS, MOTIVOS_RECHAZO


def get_public_config(db: Database) -> dict:
    portal = repository.get_portal(db)
    return {
        "portal": {
            "nombre": portal["nombre_portal"],
            "avisar_rechazo": portal["avisar_rechazo"],
            "datos_de_ejemplo": portal["datos_de_ejemplo"],
        },
        "sectores": catalog.list_sectors(db),
        "etiquetas": catalog.list_tag_names(db),
        "epocas": list(EPOCAS),
        "motivos_rechazo": [dict(motivo) for motivo in MOTIVOS_RECHAZO],
    }
