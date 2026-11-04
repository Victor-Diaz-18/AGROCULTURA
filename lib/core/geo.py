"""Small geographic helpers."""

from __future__ import annotations

from math import asin, cos, radians, sin, sqrt


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in kilometers between two points (haversine)."""
    d_lat, d_lon = radians(lat2 - lat1), radians(lon2 - lon1)
    h = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return 2 * 6371 * asin(sqrt(h))
