from __future__ import annotations

import uuid

from lib.media import validation
from lib.media.storage import Storage


def save_media(storage: Storage, *, user_id: str, tipo: str, content: bytes, duracion_s: int | None) -> dict:
    """Checks the file and stores it under `historias/<user id>/`. Returns what the story will keep."""
    mime, extension = validation.check_media(tipo, content)
    url = storage.save(f"historias/{user_id}/{uuid.uuid4().hex}.{extension}", content, mime)
    return {
        "tipo": tipo,
        "url": url,
        "mime": mime,
        "bytes": len(content),
        "duracion_s": duracion_s if tipo == "audio" else None,
    }
