"""Business rules for stories."""

from __future__ import annotations

import unicodedata
from datetime import datetime

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from lib.catalog import service as catalog
from lib.core.clock import utcnow
from lib.core.errors import InvalidDataError
from lib.media.validation import check_media_url
from lib.stories import repository
from lib.stories.constants import ORIGENES, TIPOS_MEDIO
from lib.stories.schemas import HistoriaIn


def get_stats(db: Database) -> dict:
    """Counters shown in the header, the map cards and the admin summary."""
    por_origen = {origen: repository.count(db, estado="publicada", origen=origen) for origen in ORIGENES}
    return {
        "publicadas": repository.count(db, estado="publicada"),
        "en_revision": repository.count(db, estado="revision"),
        "rechazadas": repository.count(db, estado="rechazada"),
        "aprobadas_comunidad": por_origen["comunidad"],
        "por_origen": por_origen,
        "sectores_con_historias": len(repository.distinct_sector_ids(db, estado="publicada")),
        "total_sectores": len(catalog.list_sectors(db)),
        "formatos": {
            tipo: repository.count(db, estado="publicada", medio=tipo) for tipo in TIPOS_MEDIO
        },
    }


# ---- telling a story ---------------------------------------------------------


def _iso(moment: datetime | None) -> str:
    """UTC time with the Z, so browsers do not read it as local time."""
    return moment.isoformat(timespec="seconds") + "Z" if moment else ""


def _search_text(*parts: str) -> str:
    """Lowercase, accent-free text used by the search box (F11)."""
    joined = " ".join(part for part in parts if part)
    return "".join(c for c in unicodedata.normalize("NFD", joined.lower()) if unicodedata.category(c) != "Mn")


def formats_of(story: dict) -> list[str]:
    """Display formats of a story, in the design's order. A story with no media is "Texto"."""
    kinds = {medio["tipo"] for medio in story.get("medios", [])}
    labels = [label for kind, label in (("audio", "Audio"), ("foto", "Foto"), ("video", "Video")) if kind in kinds]
    return labels or ["Texto"]


def create_story(db: Database, *, user: dict, data: HistoriaIn, now: datetime | None = None) -> tuple[dict, bool]:
    """Creates a community story ALWAYS "en revisión". Returns (story, created).

    Sending the same `client_id` again returns the story already created instead of a copy.
    """
    now = now or utcnow()
    author_id = user["_id"]

    existing = repository.find_by_client_id(db, author_id, data.client_id)
    if existing:
        return existing, False

    sector = catalog.get_sector(db, data.sector_id)
    if sector is None:
        raise InvalidDataError("Ese sector no existe. Elige uno de la lista.")
    available_tags = set(catalog.list_tag_names(db))
    for tag in data.etiquetas:
        if tag not in available_tags:
            raise InvalidDataError(f"La etiqueta {tag} ya no está disponible. Elige otra.")
    for medio in data.medios:
        check_media_url(medio.url, str(author_id))

    document = {
        "client_id": data.client_id,
        "titulo": data.titulo,
        "texto": data.texto,
        "epoca": data.epoca,
        "fecha_hechos": None,  # the design only asks for the epoch
        "sector_id": sector["_id"],
        "etiquetas": data.etiquetas,
        "ubicacion": {"type": "Point", "coordinates": [round(data.ubicacion.lon, 6), round(data.ubicacion.lat, 6)]},
        "ubicacion_origen": data.ubicacion_origen,
        "medios": [medio.model_dump(exclude_none=True) for medio in data.medios],
        "autor_id": author_id,
        "narrador_nombre": user["nombre"],
        # Decided here, never by the client: nothing is published without an administrator.
        "estado": "revision",
        "motivo_rechazo": None,
        "origen": "comunidad",
        "ejemplo": False,
        "busqueda": _search_text(data.titulo, user["nombre"], sector["nombre"], data.epoca, " ".join(data.etiquetas)),
        "creada_en": now,
        "enviada_en": now,
        "revisada_en": None,
        "revisada_por": None,
        "publicada_en": None,
    }

    for _ in range(3):  # a repeated code can only happen if someone edited the counter by hand
        document["codigo"] = f"HIS-{now.year}-{repository.next_code_number(db, now.year):03d}"
        try:
            return repository.insert(db, document), True
        except DuplicateKeyError:
            again = repository.find_by_client_id(db, author_id, data.client_id)
            if again:  # two sends of the same draft arrived together: the other one won
                return again, False
            document.pop("_id", None)
    raise InvalidDataError("No pudimos guardar tu historia. Intenta de nuevo.")


def story_out(story: dict) -> dict:
    return {
        "codigo": story["codigo"],
        "titulo": story["titulo"],
        "estado": story["estado"],
        "enviada_en": _iso(story.get("enviada_en")),
    }


def my_stories(db: Database, user: dict) -> list[dict]:
    """The narrator's own stories (every state), newest first, with the reason when one was rejected."""
    return [
        {
            "codigo": story["codigo"],
            "titulo": story["titulo"],
            "sector_id": story["sector_id"],
            "epoca": story["epoca"],
            "formatos": formats_of(story),
            "estado": story["estado"],
            "motivo_rechazo": story.get("motivo_rechazo"),
            "enviada_en": _iso(story.get("enviada_en") or story.get("creada_en")),
        }
        for story in repository.list_by_author(db, user["_id"])
    ]
