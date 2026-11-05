"""The voice of the portal: audio of public content only, made once and kept.

There is no way to ask for the audio of an arbitrary text. The server knows what can be read (the opening, the map, the first farms,
the fixed words of each page, the cards of published stories) and writes the words itself, from what the public API already gives. So an unpublished story, a real
name kept private or a place hidden by its narrator can never reach the voice service, and nobody can spend the quota on other things.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from pymongo.database import Database

from lib.catalog import service as catalog
from lib.core.errors import NotFoundError, TooManyRequestsError
from lib.core.settings import Settings
from lib.media.storage import Storage
from lib.stories import consent
from lib.stories import service as stories
from lib.voice import azure

CACHE = "voz_cache"
USE = "voz_uso"
_TEXTS = json.loads((Path(__file__).parent / "fincas.json").read_text(encoding="utf-8"))
_PAGES = json.loads((Path(__file__).parent / "paginas.json").read_text(encoding="utf-8"))


def for_speech(text: str) -> str:
    """Written signs a voice stumbles on. The same rules as prepareForSpeech in src/context/SpeechContext.jsx."""
    text = re.sub(r"(\d)\.(?=\d{3}\b)", r"\1", text)
    text = re.sub(r"(\d)\s?km\b", r"\1 kilómetros", text)
    text = re.sub(r"(\d)\s?m\b", r"\1 metros", text)
    text = re.sub(r"\s·\s", ", ", text)
    return re.sub(r"[«»#]", "", text)


def _count(value: int, one: str, many: str) -> str:
    return f"{value} {one if value == 1 else many}"


def text_of_opening(db: Database) -> str:
    """What the opening of the portal says for someone without an account. Nothing about what waits for review."""
    numbers = stories.get_stats(db)
    sectors = [sector["nombre"] for sector in catalog.list_sectors(db)]
    parts = [
        "La memoria del café de Minca, contada por sus familias.",
        "Escucha sus voces, mira sus fotos y lee sus relatos, guardados en un mapa. Para explorar no necesitas una cuenta.",
        f"Las historias son de {', '.join(sectors[:-1])} y {sectors[-1]}." if len(sectors) > 1 else "",
        f"Hay {_count(numbers['publicadas'], 'historia publicada', 'historias publicadas')}." if numbers["publicadas"] else "",
        "Para contar tu historia, toca el botón rojo, Contar una historia.",
    ]
    return " ".join(part for part in parts if part)


def text_of_map(db: Database) -> str:
    """What the map says to someone signed in. The counters are the public ones; the zone in view is left out (it would make a new audio per movement)."""
    numbers = stories.get_stats(db)
    parts = [
        "Mapa de historias. Historias aprobadas de la cultura cafetera, con un lugar aproximado en el mapa cuando su narrador lo permite.",
        f"Hay {_count(numbers['publicadas'], 'historia publicada', 'historias publicadas')}: "
        f"{numbers['aprobadas_comunidad']} de la comunidad y {numbers['por_origen']['proyecto']} del proyecto.",
        f"{numbers['sectores_con_historias']} de {numbers['total_sectores']} sectores tienen historias.",
        f"Hay {_count(numbers['en_revision'], 'historia esperando revisión', 'historias esperando revisión')}.",
        "Para contar tu historia, toca el botón rojo, Contar una historia.",
    ]
    return " ".join(parts)


def text_of_page(page: str) -> str:
    """The fixed words of a page. Only those: what a person is writing or an unreviewed story never comes through here."""
    if page.startswith("contar-3-"):
        words = consent.public_texts()["narrador"].get(page.removeprefix("contar-3-"))
        if words:
            return _PAGES["contar-3"].replace("{texto}", words["texto"]).replace("{aviso}", words.get("aviso", "")).replace("  ", " ")
    elif page != "contar-3" and page in _PAGES:
        return _PAGES[page]
    raise NotFoundError("Esa página no tiene voz.")


def text_of_farms() -> str:
    farms = [f"{item['title']}, {item['when']}. {item['text']}" for item in _TEXTS["fincas"]]
    facts = [f"{item['value']} {item['text']}" for item in _TEXTS["datos"]]
    return " ".join([*farms, "Datos de la zona.", *facts])


def text_of_story(db: Database, code: str) -> str:
    """The public card, read: `get_published` answers 404 unless it is published, and hides what its narrator asked to hide."""
    story = stories.get_published(db, code)
    place = story.get("lugar_nombre") or next(
        (sector["nombre"] for sector in catalog.list_sectors(db) if sector["id"] == story.get("sector_id")), ""
    )
    when = story.get("epoca", "")
    parts = [
        f"{story['titulo']}.",
        f"Ocurrió {when}, en {place}." if story.get("con_ubicacion") and place else f"Ocurrió {when}.",
        f"Finca o marca: {story['finca_nombre']}." if story.get("finca_nombre") else "",
        f"Narra {story['narrador_nombre']}." if story.get("narrador_nombre") else "",
        story.get("texto") or "Esta historia está contada en audio.",
    ]
    return " ".join(part for part in parts if part)


def _spend(db: Database, settings: Settings, characters: int) -> None:
    """Counts what is about to be turned into audio; past the limit of the day, the app reads with the voice of the device."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    used = db[USE].find_one_and_update(
        {"_id": today}, {"$inc": {"caracteres": characters}}, upsert=True, return_document=True
    )
    if used["caracteres"] > settings.voz_max_caracteres_dia:
        db[USE].update_one({"_id": today}, {"$inc": {"caracteres": -characters}})
        raise TooManyRequestsError("La voz del portal ya leyó todo lo de hoy.")


def audio_of(db: Database, settings: Settings, storage: Storage, text: str) -> str:
    """The address of the audio of this text, made only the first time."""
    text = for_speech(text)
    key = hashlib.sha256(f"{settings.azure_speech_voice}|{text}".encode()).hexdigest()
    kept = db[CACHE].find_one({"_id": key})
    if kept:
        return kept["url"]
    _spend(db, settings, len(text))
    audio = azure.synthesize(settings, text)
    url = storage.save(f"voz/{key}.mp3", audio, azure.AUDIO_TYPE)
    db[CACHE].update_one({"_id": key}, {"$set": {"url": url, "caracteres": len(text)}}, upsert=True)
    return url


def voice_of_opening(db: Database, settings: Settings, storage: Storage) -> str:
    return audio_of(db, settings, storage, text_of_opening(db))


def voice_of_map(db: Database, settings: Settings, storage: Storage) -> str:
    return audio_of(db, settings, storage, text_of_map(db))


def voice_of_page(db: Database, settings: Settings, storage: Storage, page: str) -> str:
    return audio_of(db, settings, storage, text_of_page(page))


def voice_of_farms(db: Database, settings: Settings, storage: Storage) -> str:
    return audio_of(db, settings, storage, text_of_farms())


def voice_of_story(db: Database, settings: Settings, storage: Storage, code: str) -> str:
    return audio_of(db, settings, storage, text_of_story(db, code))



