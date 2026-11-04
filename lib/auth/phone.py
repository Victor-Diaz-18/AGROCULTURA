"""Colombian mobile numbers: 10 digits starting with 3, optionally with the +57 prefix."""

from __future__ import annotations

import re


def normalize_phone(raw: str | None) -> str | None:
    """Digits only, without the country code. Returns None if it is not a mobile number."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    return digits if re.fullmatch(r"3\d{9}", digits) else None
