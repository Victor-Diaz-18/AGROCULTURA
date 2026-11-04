"""What the administrators do with stories: review them (F6) and add the team's own (F12)."""

from __future__ import annotations

from datetime import datetime

from pymongo.database import Database

from lib.core.clock import utcnow
from lib.core.errors import ConflictError, InvalidDataError, NotFoundError
from lib.stories import repository, service
from lib.stories.constants import COMPROBACIONES, ESTADOS, MOTIVOS_RECHAZO, ORIGENES
from lib.stories.schemas import HistoriaProyectoIn

MAX_LIST = 200


def story_for_admin(story: dict) -> dict:
    """Everything an administrator needs to read or review a story."""
    return {
        "codigo": story["codigo"],
        "titulo": story["titulo"],
        "texto": story.get("texto", ""),
        "narrador_nombre": story.get("narrador_nombre", ""),
        "sector_id": story["sector_id"],
        "epoca": story["epoca"],
        "etiquetas": story.get("etiquetas", []),
        "formatos": service.formats_of(story),
        "medios": [
            {key: medio.get(key) for key in ("tipo", "url", "mime", "bytes", "duracion_s")}
            for medio in story.get("medios", [])
        ],
        "estado": story["estado"],
        "origen": story["origen"],
        "ejemplo": bool(story.get("ejemplo")),
        "motivo_rechazo": story.get("motivo_rechazo"),
        "lat": service._coordinates(story)[0],
        "lon": service._coordinates(story)[1],
        "enviada_en": service._iso(story.get("enviada_en") or story.get("creada_en")),
        "revisada_en": service._iso(story.get("revisada_en")),
        "publicada_en": service._iso(story.get("publicada_en")),
    }


def list_stories(db: Database, *, estado: str | None, origen: str | None, limit: int = 100) -> list[dict]:
    if estado is not None and estado not in ESTADOS:
        raise InvalidDataError("Ese estado no existe.")
    if origen is not None and origen not in ORIGENES:
        raise InvalidDataError("Ese origen no existe.")
    limit = max(1, min(limit, MAX_LIST))
    return [story_for_admin(story) for story in repository.list_for_admin(db, estado=estado, origen=origen, limit=limit)]


def _not_decided(db: Database, code: str) -> Exception:
    """Why a story could not be decided: it does not exist, or somebody already decided it."""
    story = repository.find_by_code(db, code)
    if story is None:
        return NotFoundError("No encontramos esa historia.")
    if story["origen"] != "comunidad":
        return ConflictError("Las historias del proyecto se publican de una vez: no pasan por revisión.")
    label = "publicada" if story["estado"] == "publicada" else "rechazada"
    return ConflictError(f"Esa historia ya fue revisada: quedó {label}. Actualiza la lista.")


def approve(db: Database, code: str, *, admin: dict, confirmed: list[str], now: datetime | None = None) -> dict:
    """Publishes a story that was waiting for review, once the three checks are confirmed."""
    if not set(COMPROBACIONES).issubset(confirmed):
        raise InvalidDataError("Marca las tres comprobaciones antes de aprobar la historia.")
    now = now or utcnow()
    story = repository.decide(
        db,
        code,
        {
            "estado": "publicada",
            "motivo_rechazo": None,
            "revisada_en": now,
            "revisada_por": admin["_id"],
            "publicada_en": now,
        },
    )
    if story is None:
        raise _not_decided(db, code)
    return story_for_admin(story)


def reject(db: Database, code: str, *, admin: dict, reason_id: str, now: datetime | None = None) -> dict:
    """Rejects a story that was waiting for review. A reason is required: the narrator reads it."""
    reason = next((item for item in MOTIVOS_RECHAZO if item["id"] == reason_id), None)
    if reason is None:
        raise InvalidDataError("Elige el motivo del rechazo.")
    now = now or utcnow()
    story = repository.decide(
        db,
        code,
        {
            "estado": "rechazada",
            "motivo_rechazo": reason["texto"],  # kept as written: a later edit of the list does not rewrite history
            "revisada_en": now,
            "revisada_por": admin["_id"],
            "publicada_en": None,
        },
    )
    if story is None:
        raise _not_decided(db, code)
    return story_for_admin(story)


def create_project_story(
    db: Database, *, admin: dict, data: HistoriaProyectoIn, now: datetime | None = None
) -> tuple[dict, bool]:
    """A story the team uploads: published at once and marked as "del proyecto". Returns (story, created)."""
    story, created = service.insert_story(
        db,
        user=admin,
        data=data,
        origen="proyecto",
        estado="publicada",
        narrador_nombre=data.narrador_nombre,
        now=now,
    )
    return story_for_admin(story), created
