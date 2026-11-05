"""The consent a story is published with: the texts the person was shown, their version, and the record kept with the story.

The texts live in `consentimiento.json`, read by this module and also by the app (one source, so the words a narrator
accepts are the words the server has a version of). There are four texts for each audience, one for every combination of
"with / without my name" and "approximate place / no place". When any word changes, the version changes: a story keeps the
version (and the date) of the text its narrator accepted.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from lib.core.errors import InvalidDataError

TEXTS = json.loads(Path(__file__).with_name("consentimiento.json").read_text(encoding="utf-8"))
VERSION: str = TEXTS["version"]

DE_NARRADOR = "narrador"  # the narrator authorizes their own story
DE_EQUIPO = "equipo"  # the team says it has the authorization of whoever told a story it uploads

# Whether a story MUST come with the consent: without it a story cannot be sent, and an administrator cannot publish a story that
# carries no record of its authorization (it can be rejected). It was introduced off, while the screens learned to ask for it.
EXIGIR_CONSENTIMIENTO = True

MESSAGE_REQUIRED = "Para enviar tu historia debes autorizar que se publique."
MESSAGE_OLD_VERSION = "El texto de la autorización cambió. Actualiza la página y vuelve a marcarla."

# A story kept on a phone without signal is sent later, so the moment of acceptance is the phone's. It is believed only if it is
# plausible: not from the future and not from long ago.
_MAX_FUTURE = timedelta(minutes=10)
_MAX_PAST = timedelta(days=90)


def variant(*, anonima: bool, modo: str) -> str:
    """Which of the four texts applies: `aproximada_con_nombre`, `aproximada_sin_nombre`, `ninguna_con_nombre`, `ninguna_sin_nombre`."""
    return f"{modo}_{'sin' if anonima else 'con'}_nombre"


def public_texts() -> dict:
    """What /api/config serves: the version and every text."""
    return TEXTS


def _moment(accepted: datetime | None, now: datetime) -> datetime:
    if accepted is None:
        return now
    if accepted.tzinfo is not None:
        accepted = accepted.astimezone(timezone.utc).replace(tzinfo=None)
    return accepted if now - _MAX_PAST <= accepted <= now + _MAX_FUTURE else now


def record(consent, *, anonima: bool, modo: str, de: str, now: datetime) -> dict | None:
    """The record stored with a story: version, text variant, who authorizes and when. None when none was sent and it is not demanded yet."""
    if consent is None:
        if EXIGIR_CONSENTIMIENTO:
            raise InvalidDataError(MESSAGE_REQUIRED)
        return None
    if consent.version != VERSION:
        raise InvalidDataError(MESSAGE_OLD_VERSION)
    return {
        "version": VERSION,
        "variante": variant(anonima=anonima, modo=modo),
        "de": de,
        "aceptado_en": _moment(consent.aceptado_en, now),
    }
