"""Small builders for documents used across the backend tests."""

from __future__ import annotations

from datetime import datetime, timezone

_counter = {"n": 0}


def make_story(**overrides) -> dict:
    """A valid `historias` document. Override any field you care about."""
    _counter["n"] += 1
    n = _counter["n"]
    story = {
        "codigo": f"HIS-2026-{n:03d}",
        "titulo": f"Historia de prueba {n}",
        "texto": "Texto de la historia.",
        "epoca": "1960 a 1979",
        "sector_id": "minca",
        "etiquetas": ["#café"],
        "ubicacion": {"type": "Point", "coordinates": [-74.1180, 11.1400]},
        "medios": [],
        "autor_id": "autor-de-prueba",
        "narrador_nombre": "Narrador de prueba",
        "estado": "publicada",
        "motivo_rechazo": None,
        "origen": "comunidad",
        "ejemplo": False,
        "creada_en": datetime(2026, 9, 1, tzinfo=timezone.utc),
        "publicada_en": datetime(2026, 9, 2, tzinfo=timezone.utc),
    }
    story.update(overrides)
    return story


# ---- what a narrator's phone sends --------------------------------------------

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 200  # starts like a JPEG
WEBM_AUDIO = b"\x1a\x45\xdf\xa3" + b"\x00" * 200  # starts like what MediaRecorder writes


def story_payload(**overrides) -> dict:
    """A valid POST /api/historias body. Override any field."""
    _counter["n"] += 1
    payload = {
        "client_id": f"borrador-{_counter['n']:06d}",
        "titulo": "El camino de mulas",
        "texto": "Antes de que hubiera carretera, el café bajaba en mula.",
        "epoca": "Antes de 1960",
        "sector_id": "minca",
        "etiquetas": ["#café"],
        "ubicacion": {"lat": 11.14, "lon": -74.118},
        "ubicacion_origen": "sector",
        "medios": [],
    }
    payload.update(overrides)
    return payload
