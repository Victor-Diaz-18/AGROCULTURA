"""What the public sees of WHO told a story and of WHERE: never more than the narrator agreed to.

WHERE. A narrator who uses "Usar mi ubicación" or taps the map may be standing at home, and the team's own stories can be
told in a private place too. The exact point is kept (the administrators need it to review the story) but the map, the list
and the card show the point rounded to a grid of about 500 m, whoever tells the story. A point placed on a sector button is
shown as it is: it is the sector's center, not anybody's position.
A story published WITHOUT a place has no point at all, and the sector and the place name it carries are only a reference for
the administrators: the public gets none of the three.

WHO. A story published without its narrator's name says "Narrador anónimo" to the public. The real name stays for the
administrators and for its own narrator.
"""

from __future__ import annotations

from lib.stories.constants import NARRADOR_ANONIMO

# 0.005 degrees are about 550 m. The rounded point is at most ~390 m from the real one.
GRID_DEGREES = 0.005


def has_location(story: dict) -> bool:
    """Does the story have a place on the map? A document without a point counts as "no place": the safe reading."""
    return story.get("ubicacion_modo", "aproximada") != "ninguna" and bool(story.get("ubicacion"))


def is_approximate(story: dict) -> bool:
    return story.get("ubicacion_origen") in ("gps", "mapa")


def public_point(story: dict) -> tuple[float, float, bool] | None:
    """(lat, lon, approximate) as the public sees them, or None when the story has no place on the map."""
    if not has_location(story):
        return None
    lon, lat = story["ubicacion"]["coordinates"]
    if not is_approximate(story):
        return lat, lon, False
    snap = lambda value: round(round(value / GRID_DEGREES) * GRID_DEGREES, 6)  # noqa: E731
    return snap(lat), snap(lon), True


def public_narrator(story: dict) -> str:
    """The name the public reads: the narrator's, or "Narrador anónimo" if they asked not to be named."""
    return NARRADOR_ANONIMO if story.get("anonima") else story.get("narrador_nombre", "")
