"""Business rules for stories."""

from __future__ import annotations

import unicodedata
from datetime import datetime

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from lib.catalog import service as catalog
from lib.core.clock import utcnow
from lib.core.errors import ConflictError, InvalidDataError, NotFoundError
from lib.media.validation import check_media_url, check_video
from lib.stories import privacy, repository
from lib.stories.constants import ORIGENES, TIPOS_MEDIO
from lib.stories.schemas import HistoriaIn, VideoIn


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


def search_text(*parts: str) -> str:
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
    return insert_story(
        db,
        user=user,
        data=data,
        origen="comunidad",
        estado="revision",
        narrador_nombre=user["nombre"],
        now=now,
    )


def insert_story(
    db: Database,
    *,
    user: dict,
    data: HistoriaIn,
    origen: str,
    estado: str,
    narrador_nombre: str,
    now: datetime | None = None,
) -> tuple[dict, bool]:
    """Validates against the catalog and stores a story. The CALLER decides origin and state, never the client."""
    now = now or utcnow()
    author_id = user["_id"]

    existing = repository.find_by_client_id(db, author_id, data.client_id)
    if existing:
        return existing, False

    available_tags = set(catalog.list_tag_names(db))
    for tag in data.etiquetas:
        if tag not in available_tags:
            raise InvalidDataError(f"La etiqueta {tag} ya no está disponible. Elige otra.")
    for medio in data.medios:
        check_media_url(medio.url, str(author_id))
        if medio.tipo == "video":
            check_video(medio.mime, medio.bytes, medio.url)

    # The story can be anywhere in the zone: its point is what matters. The sector is only a reference, found from
    # the point (never taken from the client), and there may be none.
    if data.ubicacion is not None:
        location = {"type": "Point", "coordinates": [round(data.ubicacion.lon, 6), round(data.ubicacion.lat, 6)]}
        sector = catalog.sector_at(
            db, data.ubicacion.lat, data.ubicacion.lon, include_provisional=data.ubicacion_origen == "sector"
        )
    else:  # a team story sent without a point (through the API): the center of the sector it names
        sector = catalog.get_sector(db, data.sector_id) if data.sector_id else None
        if sector is None:
            raise InvalidDataError("Elige dónde ocurrió: toca un punto del mapa o un sector.")
        location = dict(sector["centro"])
    sector_id = sector["_id"] if sector else None
    sector_name = sector["nombre"] if sector else ""

    published = estado == "publicada"
    document = {
        "client_id": data.client_id,
        "titulo": data.titulo,
        "texto": data.texto,
        "epoca": data.epoca,
        "fecha_hechos": None,  # the design only asks for the epoch
        "sector_id": sector_id,
        "lugar_nombre": data.lugar_nombre,
        "etiquetas": data.etiquetas,
        "ubicacion": location,
        "ubicacion_origen": data.ubicacion_origen,
        "medios": [medio.model_dump(exclude_none=True) for medio in data.medios],
        "autor_id": author_id,
        "narrador_nombre": narrador_nombre,
        "estado": estado,
        "motivo_rechazo": None,
        "origen": origen,
        "ejemplo": False,
        "busqueda": search_text(data.titulo, narrador_nombre, sector_name, data.lugar_nombre or "", data.epoca, " ".join(data.etiquetas)),
        "creada_en": now,
        "enviada_en": now,
        "revisada_en": None,
        "revisada_por": None,
        "publicada_en": now if published else None,
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
            "sector_id": story.get("sector_id"),
            "lugar_nombre": story.get("lugar_nombre"),
            "epoca": story["epoca"],
            "formatos": formats_of(story),
            "estado": story["estado"],
            "motivo_rechazo": story.get("motivo_rechazo"),
            "enviada_en": _iso(story.get("enviada_en") or story.get("creada_en")),
        }
        for story in repository.list_by_author(db, user["_id"])
    ]


# ---- what everybody can see: the map and the card ---------------------------------


def _coordinates(story: dict) -> tuple[float, float]:
    """(lat, lon) of a story: GeoJSON keeps [lon, lat]."""
    lon, lat = story["ubicacion"]["coordinates"]
    return lat, lon


def story_for_map(story: dict) -> dict:
    lat, lon, approximate = privacy.public_point(story)  # the exact point never leaves through here
    first_photo = next((m.get("url") for m in story.get("medios", []) if m.get("tipo") == "foto" and m.get("url")), None)
    return {
        "codigo": story["codigo"],
        "titulo": story["titulo"],
        "narrador_nombre": story.get("narrador_nombre", ""),
        "sector_id": story.get("sector_id"),
        "lugar_nombre": story.get("lugar_nombre"),
        "epoca": story["epoca"],
        "formatos": formats_of(story),
        "origen": story["origen"],
        "lat": lat,
        "lon": lon,
        "aproximada": approximate,
        "foto_url": first_photo,
        "etiquetas": story.get("etiquetas", []),
        "publicada_en": _iso(story.get("publicada_en")),
    }


def story_public(story: dict) -> dict:
    """The card of a published story. Never the author id, the draft id or anything about the review."""
    return {
        **story_for_map(story),
        "texto": story.get("texto", ""),
        "medios": [
            {key: medio.get(key) for key in ("tipo", "url", "mime", "duracion_s")} for medio in story.get("medios", [])
        ],
    }


def list_published(db: Database, limit: int = repository.MAX_PUBLISHED) -> list[dict]:
    limit = max(1, min(limit, repository.MAX_PUBLISHED))
    return [story_for_map(story) for story in repository.list_published(db, limit)]


def get_published(db: Database, code: str) -> dict:
    story = repository.find_published(db, code)
    if story is None:
        raise NotFoundError("No encontramos esa historia.")
    return story_public(story)


def attach_video(db: Database, *, user: dict, code: str, data: VideoIn) -> dict:
    """Adds the video to a story of this narrator that is still waiting for review.

    The phone sends the story first and the video after (a video can take long over a bad connection), so the
    story never waits for it. Sending the same video again is fine and changes nothing.
    """
    story = repository.find_by_code(db, code)
    if story is None or story.get("autor_id") != user["_id"]:
        raise NotFoundError("No encontramos esa historia.")  # also for somebody else's story: no hint that it exists
    if story["estado"] != "revision":
        raise ConflictError("Esta historia ya fue revisada: ya no se le puede agregar un video.")

    check_media_url(data.url, str(user["_id"]))
    check_video(data.mime, data.bytes, data.url)
    current = next((medio for medio in story.get("medios", []) if medio.get("tipo") == "video"), None)
    if current:
        if current.get("url") == data.url:
            return story
        raise ConflictError("Esta historia ya tiene un video.")

    medio = {"tipo": "video", **data.model_dump(exclude_none=True)}
    updated = repository.add_video(db, story["_id"], medio)
    if updated is None:  # somebody else added one, or the story was reviewed, between the read and the write
        raise ConflictError("Esta historia ya tiene un video o ya fue revisada.")
    return updated
