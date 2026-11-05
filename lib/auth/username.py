"""User names: what a person picks to sign in with, and the name their stories show."""

from __future__ import annotations

import re
import unicodedata

MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 40
MIN_PASSWORD_LENGTH = 6


def clean_username(raw: str | None) -> str:
    """Accents in one piece, single spaces and none at the ends. The capitals stay: it is shown as it was written."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", raw or "")).strip()


def username_key(raw: str | None) -> str:
    """How an account is looked up: the same name with other capitals or extra spaces is the same account."""
    return clean_username(raw).lower()
