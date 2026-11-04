"""Time helpers."""

from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC "now": what pymongo stores and returns by default."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
