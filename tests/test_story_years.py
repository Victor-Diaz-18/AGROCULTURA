"""The narrator writes the years a story happened: the first and, if it lasted, the last one."""

from __future__ import annotations

import pytest

from lib.core.clock import utcnow
from tests.factories import make_story, story_payload


def send(client, narrator, **overrides):
    return client.post("/api/historias", headers=narrator["headers"], json=story_payload(**{"epoca": None, **overrides}))


def test_a_range_of_years_is_kept_and_reads_as_a_range(client, narrator, db):
    response = send(client, narrator, anio_desde=1950, anio_hasta=1960)

    assert response.status_code == 201
    story = db.historias.find_one({"codigo": response.json()["codigo"]})
    assert (story["anio_desde"], story["anio_hasta"], story["epoca"]) == (1950, 1960, "1950 a 1960")


def test_a_single_year_needs_no_end(client, narrator, db):
    response = send(client, narrator, anio_desde=1955)

    story = db.historias.find_one({"codigo": response.json()["codigo"]})
    assert (story["anio_desde"], story["anio_hasta"], story["epoca"]) == (1955, 1955, "1955")


@pytest.mark.parametrize(
    ("desde", "hasta", "message"),
    [
        (1960, 1950, "no puede ser anterior"),
        (1500, None, "Escribe un año entre"),
        (utcnow().year + 1, None, "Escribe un año entre"),
        (1950, utcnow().year + 5, "Escribe un año entre"),
    ],
)
def test_years_that_make_no_sense_are_refused_and_say_why(client, narrator, desde, hasta, message):
    response = send(client, narrator, anio_desde=desde, anio_hasta=hasta)

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_a_story_needs_its_year(client, narrator):
    response = send(client, narrator)

    assert response.status_code == 422
    assert "año" in response.json()["detail"]


def test_a_draft_kept_with_a_period_of_before_is_still_accepted(client, narrator):
    assert client.post("/api/historias", headers=narrator["headers"], json=story_payload(epoca="1960 a 1979")).status_code == 201


def test_the_map_gives_the_years_also_for_a_story_with_a_period_of_before(client, db):
    db.historias.insert_many([
        make_story(codigo="HIS-2026-071", epoca="Antes de 1960"),
        make_story(codigo="HIS-2026-072", epoca="1950 a 1960", anio_desde=1950, anio_hasta=1960),
    ])

    stories = {story["codigo"]: story for story in client.get("/api/historias").json()}
    assert (stories["HIS-2026-071"]["anio_desde"], stories["HIS-2026-071"]["anio_hasta"]) == (None, 1959)
    assert (stories["HIS-2026-072"]["anio_desde"], stories["HIS-2026-072"]["anio_hasta"]) == (1950, 1960)
