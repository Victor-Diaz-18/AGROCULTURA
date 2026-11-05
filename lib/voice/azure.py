"""The only module that knows about Azure Speech. Turns text into audio with the voice of the portal."""

from __future__ import annotations

import logging
import urllib.error
import urllib.request
from xml.sax.saxutils import escape

from lib.core.errors import VoiceUnavailableError
from lib.core.settings import Settings

logger = logging.getLogger(__name__)

AUDIO_FORMAT = "audio-24khz-48kbitrate-mono-mp3"
AUDIO_TYPE = "audio/mpeg"
TIMEOUT_SECONDS = 25


def synthesize(settings: Settings, text: str) -> bytes:
    """The audio of the text. The text goes escaped: it can carry whatever a narrator wrote."""
    if not (settings.azure_speech_key and settings.azure_speech_region):
        raise VoiceUnavailableError("La voz del portal no está configurada.")
    ssml = f"<speak version='1.0' xml:lang='es-CO'><voice name='{settings.azure_speech_voice}'>{escape(text)}</voice></speak>"
    request = urllib.request.Request(
        f"https://{settings.azure_speech_region}.tts.speech.microsoft.com/cognitiveservices/v1",
        data=ssml.encode("utf-8"),
        method="POST",
        headers={
            "Ocp-Apim-Subscription-Key": settings.azure_speech_key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": AUDIO_FORMAT,
            "User-Agent": "agrocultura",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 (a fixed https address)
            return response.read()
    except urllib.error.HTTPError as exc:
        logger.error("Azure Speech answered %s", exc.code)  # never the key or the text
    except OSError as exc:
        logger.error("Could not reach Azure Speech (%s)", type(exc).__name__)
    raise VoiceUnavailableError("La voz del portal no está disponible en este momento.")
