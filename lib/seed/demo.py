"""The twelve example stories of the approved design, and the reset that brings them back.

REMOVABLE: this file, `lib/admin/demo_router.py`, its line in `api/index.py` and the card in the
administration screen are the whole "Reiniciar datos de ejemplo" feature. It also needs
ALLOW_DEMO_RESET, which is turned off before real families use the platform.
"""

from __future__ import annotations

import logging
from datetime import datetime

from pymongo.database import Database

from lib.auth import repository as users
from lib.auth.phone import normalize_phone
from lib.catalog import repository as catalog
from lib.config import repository as config
from lib.core.settings import Settings
from lib.media.storage import Storage
from lib.stories import repository, service
from lib.stories.constants import MOTIVOS_RECHAZO, NARRADOR_PROYECTO

logger = logging.getLogger(__name__)

YEAR = 2026  # the codes of the example stories (HIS-2026-001 ... 012)
TEAM = NARRADOR_PROYECTO
OFF_THEME = next(item["texto"] for item in MOTIVOS_RECHAZO if item["id"] == "fuera-del-tema")

# code, title, narrator, sector, epoch, kinds of media, state, origin, tags, (month, day), seconds of audio, text,
# and whether it belongs to the demo narrator. The example media only has its kind: there is no real file.
_STORIES = [
    ("001", "El camino de mulas hasta Santa Marta", "Aurelio Martínez", "minca", "Antes de 1960", ("audio", "foto"), "publicada", "comunidad", ("#café", "#oficios"), (9, 14), 204,
     "Antes de que hubiera carretera, el café bajaba en mula por el camino viejo. Mi papá salía de madrugada con la carga y volvía al otro día.", False),
    ("002", "La primera cosecha de la familia", "Rosa Elena Pérez", "la-tagua", "1960 a 1979", ("foto", "audio"), "publicada", "comunidad", ("#familia", "#cosecha"), (9, 16), 251,
     "Recuerdo la primera cosecha que recogimos todos juntos: mis hermanos, mi mamá y unos vecinos que vinieron a ayudar.", False),
    ("003", "Las mingas de recolección", "Hernando Ruiz", "san-lorenzo", "1980 a 1999", ("audio",), "publicada", "comunidad", ("#cosecha", "#familia"), (9, 20), 312,
     "Cuando una finca no daba abasto, los vecinos se juntaban a recoger. Después se compartía la comida y nadie cobraba.", False),
    ("004", "El patio donde se secaba el café", TEAM, "tijereras", "1960 a 1979", ("foto",), "publicada", "proyecto", ("#finca", "#café"), (9, 22), 0,
     "Historia preparada por el equipo del proyecto a partir de fotos y conversaciones con familias del sector.", False),
    ("005", "Cuando llegó la roya", "Luz Marina Ospina", "minca", "1980 a 1999", ("audio", "video"), "publicada", "comunidad", ("#café", "#finca"), (9, 25), 276,
     "Las hojas se llenaron de manchas y la cosecha se perdió casi entera. Ese año tocó aprender a cuidar el cafetal de otra forma.", False),
    ("006", "La fiesta de fin de cosecha", TEAM, "minca", "2000 en adelante", ("video", "foto"), "publicada", "proyecto", ("#familia", "#cocina"), (10, 1), 0,
     "Registro del proyecto sobre cómo las familias celebran el final de la cosecha.", False),
    ("007", "El fogón de leña de la casa", "", "la-tagua", "Antes de 1960", ("audio",), "publicada", "comunidad", ("#cocina", "#familia"), (10, 3), 188,
     "En el fogón de leña se tostaba el café de la casa. Mi abuela sabía por el olor cuándo estaba listo.", True),
    ("008", "El beneficiadero comunitario", "Jorge Iván Castro", "la-tagua", "2000 en adelante", ("audio", "foto"), "revision", "comunidad", ("#café", "#oficios"), (10, 18), 341,
     "Entre varias familias armamos un beneficiadero para lavar y secar el café de todos.", False),
    ("009", "Recetas con café de la abuela", "Marta Lucía Rojas", "san-lorenzo", "Antes de 1960", ("audio",), "revision", "comunidad", ("#cocina",), (10, 19), 198,
     "Con el café no solo se hacía tinto: mi abuela preparaba dulces y bebidas para las visitas.", False),
    ("010", "De la finca a la escuela", "Wilmer Rangel", "tijereras", "1980 a 1999", ("video",), "revision", "comunidad", ("#familia",), (10, 20), 0,
     "Para ir a la escuela había que caminar más de una hora entre cafetales.", False),
    ("011", "Cómo aprendí a tostar café", "", "minca", "2000 en adelante", ("audio", "foto"), "revision", "comunidad", ("#café", "#oficios"), (10, 21), 145,
     "Aprendí mirando a mi papá: el café se mueve todo el tiempo para que no se queme.", True),
    ("012", "Un viaje a la ciudad", "Carlos Peña", "minca", "2000 en adelante", (), "rechazada", "comunidad", ("#familia",), (10, 12), 0,
     "Relato de un viaje a la ciudad, sin relación con el café.", False),
]

# Small steps away from the center of the sector so that the examples do not sit on one point.
_STEP = 0.0035


def _owner(db: Database, settings: Settings):
    """The demo narrator (if the app has one): she "owns" two of the examples, as Ana does in the design."""
    phone = normalize_phone(settings.demo_narrator_phone)
    return users.find_by_usuario(db, phone) if phone else None


def build_examples(db: Database, settings: Settings) -> list[dict]:
    owner = _owner(db, settings)
    centers = {sector["_id"]: sector["centro"]["coordinates"] for sector in catalog.list_sectors(db)}
    tag_names = {sector["_id"]: sector["nombre"] for sector in catalog.list_sectors(db)}
    documents = []
    per_sector: dict[str, int] = {}
    for code, title, narrator, sector, epoch, media, state, origin, tags, (month, day), seconds, text, mine in _STORIES:
        when = datetime(YEAR, month, day, 12, 0)
        index = per_sector.get(sector, 0)
        per_sector[sector] = index + 1
        lon, lat = centers.get(sector, (-74.118, 11.14))
        name = settings.demo_narrator_name if mine else narrator
        medios = [
            {"tipo": kind, "duracion_s": seconds} if kind == "audio" and seconds else {"tipo": kind} for kind in media
        ]
        documents.append(
            {
                "codigo": f"HIS-{YEAR}-{code}",
                "titulo": title,
                "texto": text,
                "epoca": epoch,
                "fecha_hechos": None,
                "sector_id": sector,
                "etiquetas": list(tags),
                "ubicacion": {
                    "type": "Point",
                    "coordinates": [round(lon + _STEP * ((index % 3) - 1), 6), round(lat + _STEP * ((index // 3) - 0.5), 6)],
                },
                "ubicacion_origen": "sector",
                "medios": medios,
                "autor_id": owner["_id"] if (mine and owner) else None,
                "narrador_nombre": name,
                "estado": state,
                "motivo_rechazo": OFF_THEME if state == "rechazada" else None,
                "origen": origin,
                "ejemplo": True,
                "busqueda": service.search_text(title, name, tag_names.get(sector, ""), epoch, " ".join(tags)),
                "creada_en": when,
                "enviada_en": when,
                "revisada_en": when if state in ("publicada", "rechazada") and origin == "comunidad" else None,
                "revisada_por": None,
                "publicada_en": when if state == "publicada" else None,
            }
        )
    return documents


def reset_demo_data(db: Database, settings: Settings, storage: Storage) -> dict:
    """Deletes EVERY story (also the real ones and the files they point to) and loads the twelve examples."""
    urls = repository.media_urls(db)
    deleted = repository.delete_all(db)
    examples = build_examples(db, settings)
    repository.insert_many(db, examples)
    repository.set_counter(db, YEAR, len(examples))  # the next real story is HIS-2026-013
    config.update_portal(db, {"datos_de_ejemplo": True})
    files = _delete_files(storage, urls)
    return {"historias_borradas": deleted, "historias_de_ejemplo": len(examples), "archivos_borrados": files}


def _delete_files(storage: Storage, urls: list[str]) -> int:
    """Best effort: a file that cannot be deleted must not undo the reset."""
    if not urls:
        return 0
    try:
        return storage.delete(urls)
    except Exception as exc:  # noqa: BLE001
        logger.error("Could not delete %d files (%s: %s)", len(urls), type(exc).__name__, exc)
        return 0
