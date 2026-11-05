"""Public configuration served to the frontend."""

from __future__ import annotations

from pymongo.database import Database

from lib.catalog import service as catalog
from lib.config import repository
from lib.core.errors import InvalidDataError
from lib.core.settings import Settings
from lib.stories import consent
from lib.stories.constants import EPOCAS, MOTIVOS_RECHAZO


def _public_portal(portal: dict, settings: Settings) -> dict:
    return {
        "nombre": portal["nombre_portal"],
        "avisar_rechazo": portal["avisar_rechazo"],
        "datos_de_ejemplo": portal["datos_de_ejemplo"],
        "reinicio_disponible": settings.allow_demo_reset,  # shows the demo reset card to administrators
    }


def get_public_config(db: Database, settings: Settings) -> dict:
    portal = repository.get_portal(db)
    return {
        "portal": _public_portal(portal, settings),
        "sectores": catalog.list_sectors(db),
        "etiquetas": catalog.list_tag_names(db),
        "epocas": list(EPOCAS),
        "motivos_rechazo": [dict(motivo) for motivo in MOTIVOS_RECHAZO],
        "consentimiento": consent.public_texts(),
    }


def update_portal(
    db: Database,
    settings: Settings,
    *,
    nombre: str | None = None,
    avisar_rechazo: bool | None = None,
    datos_de_ejemplo: bool | None = None,
) -> dict:
    """Changes the options an administrator can edit. Returns the portal as the app sees it."""
    changes: dict = {}
    if nombre is not None:
        clean = " ".join(nombre.split())
        if not 2 <= len(clean) <= 60:
            raise InvalidDataError("El nombre del portal debe tener entre 2 y 60 letras.")
        changes["nombre_portal"] = clean
    if avisar_rechazo is not None:
        changes["avisar_rechazo"] = avisar_rechazo
    if datos_de_ejemplo is not None:
        changes["datos_de_ejemplo"] = datos_de_ejemplo
    return _public_portal(repository.update_portal(db, changes), settings)
