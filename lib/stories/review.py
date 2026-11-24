"""What the administrators do with stories: review them (F6) and add the team's own (F12)."""

from __future__ import annotations

import logging

from datetime import datetime, timedelta

from pymongo.database import Database

from lib.catalog import service as catalog
from lib.core.clock import utcnow
from lib.core.errors import ConflictError, InvalidDataError, NotFoundError
from lib.stories import consent, repository, service
from lib.stories.constants import (
    COMPROBACION_CONSENTIMIENTO,
    COMPROBACIONES,
    DIAS_EN_PAPELERA,
    ESTADOS,
    MOTIVOS_RECHAZO,
    ORIGENES,
)
from lib.stories.schemas import CorreccionIn, HistoriaProyectoIn

logger = logging.getLogger(__name__)

MAX_LIST = 200


def _consent_for_admin(record: dict | None) -> dict | None:
    if not record:
        return None
    return {**record, "aceptado_en": service._iso(record.get("aceptado_en"))}


def _correction_for_admin(story: dict) -> dict | None:
    """What the narrator wrote, when the team's correction changed it."""
    if not service.corrected_fields(story):
        return None
    record = story["correccion"]
    return {"titulo": record["titulo"], "texto": record["texto"], "por": record.get("por_nombre", ""), "en": service._iso(record.get("en"))}


def story_for_admin(story: dict) -> dict:
    """Everything an administrator needs to read or review a story."""
    return {
        "codigo": story["codigo"],
        "titulo": story["titulo"],
        "texto": story.get("texto", ""),
        "narrador_nombre": story.get("narrador_nombre", ""),
        "anonima": bool(story.get("anonima")),
        "sector_id": story.get("sector_id"),
        "lugar_nombre": story.get("lugar_nombre"),
        "finca_nombre": story.get("finca_nombre"),
        "ubicacion_modo": story.get("ubicacion_modo", "aproximada"),
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
        "consentimiento": _consent_for_admin(story.get("consentimiento")),
        "correccion": _correction_for_admin(story),
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


def required_checks() -> tuple[str, ...]:
    """The checks an approval must come with: the three of the design, and the narrator's consent once it is demanded."""
    return COMPROBACIONES + ((COMPROBACION_CONSENTIMIENTO,) if consent.EXIGIR_CONSENTIMIENTO else ())


def _not_decided(db: Database, code: str) -> Exception:
    """Why a story could not be decided: it does not exist, it has no consent, or somebody already decided it."""
    story = repository.find_by_code(db, code)
    if story is None:
        return NotFoundError("No encontramos esa historia.")
    if story["origen"] != "comunidad":
        return ConflictError("Las historias del proyecto se publican de una vez: no pasan por revisión.")
    if story["estado"] == "revision" and consent.EXIGIR_CONSENTIMIENTO and not story.get("consentimiento"):
        return InvalidDataError(
            "Esta historia se envió antes de que existiera la autorización del narrador, así que no se puede publicar. "
            "Recházala con el motivo «Falta la autorización»."
        )
    label = "publicada" if story["estado"] == "publicada" else "rechazada"
    return ConflictError(f"Esa historia ya fue revisada: quedó {label}. Actualiza la lista.")


def approve(db: Database, code: str, *, admin: dict, confirmed: list[str], now: datetime | None = None) -> dict:
    """Publishes a story that was waiting for review, once every check is confirmed (and, if demanded, it has the consent)."""
    if not set(required_checks()).issubset(confirmed):
        raise InvalidDataError("Marca todas las comprobaciones antes de aprobar la historia.")
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
        needs_consent=consent.EXIGIR_CONSENTIMIENTO,
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


def correct(db: Database, code: str, *, admin: dict, data: CorreccionIn, now: datetime | None = None) -> dict:
    """The team corrects the title and the text of a story still waiting for review (typos, a clearer title). What the
    narrator wrote is kept the first time, so the team can always read it, and the narrator is told in «Mis historias» once
    it is published. Nothing else changes: not the files, the place or the authorization."""
    story = repository.find_by_code(db, code)
    if story is None or story["estado"] != "revision" or story["origen"] != "comunidad":
        raise _not_correctable(story)
    original = story.get("correccion") or {"titulo": story["titulo"], "texto": story.get("texto", "")}
    if data.texto and not original["texto"]:
        raise InvalidDataError("Esta historia no tiene texto escrito: solo se puede corregir el título.")
    if original["texto"] and not data.texto:
        raise InvalidDataError("El texto no puede quedar vacío. Si la historia no sirve, recházala.")
    sector = catalog.get_sector(db, story["sector_id"]) if story.get("sector_id") else None
    changed = {**story, "titulo": data.titulo, "texto": data.texto}
    updated = repository.correct(
        db,
        code,
        {
            "titulo": data.titulo,
            "texto": data.texto,
            "busqueda": service.search_text_of(changed, sector["nombre"] if sector else ""),
            "correccion": {
                "titulo": original["titulo"],
                "texto": original["texto"],
                "por": admin["_id"],
                "por_nombre": admin.get("nombre") or admin["usuario"],
                "en": now or utcnow(),
            },
        },
    )
    if updated is None:  # somebody decided it in the meantime
        raise _not_correctable(repository.find_by_code(db, code))
    return story_for_admin(updated)


def _not_correctable(story: dict | None) -> Exception:
    if story is None:
        return NotFoundError("No encontramos esa historia.")
    if story["origen"] != "comunidad":
        return ConflictError("Las historias del proyecto se publican de una vez: no pasan por revisión.")
    return ConflictError("Esta historia ya se revisó: solo se corrige mientras espera revisión.")


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
        consent_from=consent.DE_EQUIPO,
        now=now,
    )
    return story_for_admin(story), created


# ---- the trash: a deleted story can be brought back for DIAS_EN_PAPELERA days -------


def _deleted_for_good_on(story: dict) -> datetime:
    return story["borrada_en"] + timedelta(days=DIAS_EN_PAPELERA)


def trashed_story(story: dict) -> dict:
    """A story of the trash: what the administrators see of any story, and when it went there and when it goes for good."""
    return {
        **story_for_admin(story),
        "borrada_en": service._iso(story["borrada_en"]),
        "se_borra_el": service._iso(_deleted_for_good_on(story)),
    }


def _delete_files(story: dict, delete_files) -> int:
    """Deletes a story's photos, audio and video. A file that cannot be deleted is logged; it never stops the rest."""
    urls = [medio["url"] for medio in story.get("medios", []) if isinstance(medio.get("url"), str)]
    if not urls:
        return 0
    try:
        return delete_files(urls)
    except Exception as exc:  # noqa: BLE001
        logger.error("Could not delete the %d files of %s (%s)", len(urls), story["codigo"], type(exc).__name__)
        return 0


def empty_expired(db: Database, *, delete_files, now: datetime | None = None) -> int:
    """Deletes for good, with their files, the stories that have been in the trash DIAS_EN_PAPELERA days or more.

    There is no clock that runs it: it runs whenever the trash is opened or a story is sent to it, so a story can stay a
    little longer than that, never less."""
    moment = (now or utcnow()) - timedelta(days=DIAS_EN_PAPELERA)
    expired = repository.delete_trashed_before(db, moment)
    for story in expired:
        _delete_files(story, delete_files)
    return len(expired)


def move_to_trash(db: Database, code: str, *, admin: dict, delete_files, now: datetime | None = None) -> dict:
    """What «Borrar historia» does: the story leaves the map, the lists and its card (also its narrator's «Mis historias»),
    but it keeps its files and can be restored for DIAS_EN_PAPELERA days. Only published stories: the queue is decided by
    approving or rejecting."""
    now = now or utcnow()
    story = repository.move_to_trash(db, code, {"borrada_en": now, "borrada_por": admin["_id"]})
    if story is None:
        raise NotFoundError("Esa historia no está publicada o ya se borró.")
    empty_expired(db, delete_files=delete_files, now=now)
    return trashed_story(story)


def list_trash(db: Database, *, delete_files, now: datetime | None = None) -> list[dict]:
    """The stories in the trash, the last one deleted first. The ones whose time is over are deleted for good first."""
    empty_expired(db, delete_files=delete_files, now=now)
    return [trashed_story(story) for story in repository.list_trash(db)]


def restore(db: Database, code: str) -> dict:
    """Brings a story back from the trash: it is published again as it was, on the map and in its narrator's list."""
    story = repository.restore_from_trash(db, code)
    if story is None:
        raise NotFoundError("Esa historia ya no está en la papelera.")
    return story_for_admin(story)


def delete_forever(db: Database, code: str, *, delete_files) -> dict:
    """Deletes a story of the trash for good, with its photos, audio and video, without waiting for its days to pass."""
    story = repository.delete_from_trash(db, code)
    if story is None:
        raise NotFoundError("Esa historia ya no está en la papelera.")
    return {"codigo": code, "archivos_borrados": _delete_files(story, delete_files)}
