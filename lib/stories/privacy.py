"""What the public sees of WHERE a story was told: a point that is only approximate.

A narrator who uses "Usar mi ubicación" or taps the map may be standing at home. The exact point is kept (the
administrators need it to review the story) but the map, the list and the card show the point rounded to a grid of
about 500 m. Points that are not private are shown as they are: those placed on a sector button (they are the
sector's center, not a person's position) and the team's own stories (the team chose the place on purpose).
"""

from __future__ import annotations

# 0.005 degrees are about 550 m. The rounded point is at most ~390 m from the real one.
GRID_DEGREES = 0.005


def is_approximate(story: dict) -> bool:
    return story.get("origen") == "comunidad" and story.get("ubicacion_origen") in ("gps", "mapa")


def public_point(story: dict) -> tuple[float, float, bool]:
    """(lat, lon, approximate) as the public sees them."""
    lon, lat = story["ubicacion"]["coordinates"]
    if not is_approximate(story):
        return lat, lon, False
    snap = lambda value: round(round(value / GRID_DEGREES) * GRID_DEGREES, 6)  # noqa: E731
    return snap(lat), snap(lon), True
