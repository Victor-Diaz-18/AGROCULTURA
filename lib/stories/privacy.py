"""What the public sees of WHERE a story was told: a point that is only approximate.

A narrator who uses "Usar mi ubicación" or taps the map may be standing at home, and the team's own stories can
be told in a private place too. The exact point is kept (the administrators need it to review the story) but the map,
the list and the card show the point rounded to a grid of about 500 m, whoever tells the story. A point placed on a
sector button is shown as it is: it is the sector's center, not anybody's position.
"""

from __future__ import annotations

# 0.005 degrees are about 550 m. The rounded point is at most ~390 m from the real one.
GRID_DEGREES = 0.005


def is_approximate(story: dict) -> bool:
    return story.get("ubicacion_origen") in ("gps", "mapa")


def public_point(story: dict) -> tuple[float, float, bool]:
    """(lat, lon, approximate) as the public sees them."""
    lon, lat = story["ubicacion"]["coordinates"]
    if not is_approximate(story):
        return lat, lon, False
    snap = lambda value: round(round(value / GRID_DEGREES) * GRID_DEGREES, 6)  # noqa: E731
    return snap(lat), snap(lon), True
