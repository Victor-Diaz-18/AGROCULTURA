"""What we accept as a photo or an audio, decided by the file CONTENT (not its name or declared type)."""

from __future__ import annotations

from urllib.parse import urlsplit

from lib.core.errors import InvalidDataError, PayloadTooLargeError

# A Vercel function accepts about 4.5 MB per request: stay below it with room for the multipart envelope.
# The phone compresses before uploading (photos under 1 MB, audio at a low bitrate), so this is generous.
MAX_MEDIA_BYTES = 3_500_000

# A video goes straight from the phone to Blob (api/blob-token.js): the 25 MB limit is the one the token enforces.
MAX_VIDEO_BYTES = 25_000_000  # 25 MB as phones count them (millions of bytes)
VIDEO_MIMES = {"video/mp4", "video/quicktime", "video/webm"}
VIDEO_EXTENSIONS = (".mp4", ".mov", ".webm")

EXTENSION = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
}
ALLOWED = {
    "foto": {"image/jpeg", "image/png", "image/webp"},
    "audio": {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"},
}


def sniff(content: bytes) -> str | None:
    """The real type of the file from its first bytes, or None if we do not recognize it."""
    if content[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if content[:4] == b"\x1a\x45\xdf\xa3":  # EBML: what MediaRecorder writes in Chrome and Firefox
        return "audio/webm"
    if content[:4] == b"OggS":
        return "audio/ogg"
    if content[4:8] == b"ftyp":  # MP4 container: what MediaRecorder writes on iPhones
        return "audio/mp4"
    if content[:3] == b"ID3" or content[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "audio/mpeg"
    return None


def check_media(tipo: str, content: bytes) -> tuple[str, str]:
    """Validates an uploaded file; returns (mime, extension) or raises a user-facing error."""
    if tipo not in ALLOWED:
        raise InvalidDataError("El tipo de archivo debe ser «foto» o «audio».")
    if not content:
        raise InvalidDataError("El archivo está vacío.")
    if len(content) > MAX_MEDIA_BYTES:
        raise PayloadTooLargeError(
            "El archivo es muy pesado. Las fotos y los audios se reducen antes de subirlos; "
            "prueba con una foto más pequeña o un audio más corto."
        )
    mime = sniff(content)
    if mime not in ALLOWED[tipo]:
        what = "una foto (JPG, PNG o WebP)" if tipo == "foto" else "un audio"
        raise InvalidDataError(f"El archivo no es {what} válido.")
    return mime, EXTENSION[mime]


def check_media_url(url: str, user_id: str) -> None:
    """A story may only point at files THIS user uploaded to our Blob store."""
    parts = urlsplit(url)
    host = parts.hostname or ""
    if not (
        parts.scheme == "https"
        and host.endswith(".public.blob.vercel-storage.com")
        and parts.path.startswith(f"/historias/{user_id}/")
    ):
        raise InvalidDataError("Uno de los archivos adjuntos no es válido. Vuelve a subirlo.")


def check_video(mime: str | None, size: int | None, url: str) -> None:
    """What a story may say about its video: a video type, at most 25 MB (the token enforced it too) and a video name."""
    if mime not in VIDEO_MIMES:
        raise InvalidDataError("El video debe ser MP4, MOV o WebM.")
    if size is not None and size > MAX_VIDEO_BYTES:
        raise InvalidDataError("El video pesa más de 25 MB.")
    if not urlsplit(url).path.lower().endswith(VIDEO_EXTENSIONS):
        raise InvalidDataError("Uno de los archivos adjuntos no es válido. Vuelve a subirlo.")
