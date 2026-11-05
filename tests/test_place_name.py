"""The optional name of the place ("Finca La Esperanza")."""

import pytest

from lib.stories import consent
from tests.factories import story_payload

APPROVAL = {"confirmaciones": ["tema", "territorio", "datos", "consentimiento"]}


def tell(client, headers, **overrides):
    return client.post("/api/historias", headers=headers, json=story_payload(**overrides))


def test_it_is_optional(client, db, narrator):
    response = tell(client, narrator["headers"])

    assert response.status_code == 201
    assert db.historias.find_one({"codigo": response.json()["codigo"]})["lugar_nombre"] is None


def test_it_is_kept_without_extra_spaces(client, db, narrator):
    code = tell(client, narrator["headers"], lugar_nombre="  Finca   La Esperanza ").json()["codigo"]

    assert db.historias.find_one({"codigo": code})["lugar_nombre"] == "Finca La Esperanza"


@pytest.mark.parametrize("value", ["", "   ", None])
def test_a_blank_name_is_the_same_as_none(client, db, narrator, value):
    code = tell(client, narrator["headers"], lugar_nombre=value).json()["codigo"]

    assert db.historias.find_one({"codigo": code})["lugar_nombre"] is None


def test_a_name_that_is_too_long_is_refused(client, narrator):
    response = tell(client, narrator["headers"], lugar_nombre="x" * 81)

    assert response.status_code == 422
    assert "muy largo" in response.json()["detail"]


def test_it_shows_up_for_the_narrator_the_review_the_map_and_the_card(client, narrator, admin):
    code = tell(client, narrator["headers"], lugar_nombre="Finca La Esperanza").json()["codigo"]
    in_review = client.get("/api/admin/historias?estado=revision", headers=admin["headers"]).json()[0]
    client.post(f"/api/admin/historias/{code}/aprobar", headers=admin["headers"], json=APPROVAL)

    mine = client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]
    on_the_map = client.get("/api/historias").json()[0]
    card = client.get(f"/api/historias/{code}").json()

    assert in_review["lugar_nombre"] == mine["lugar_nombre"] == on_the_map["lugar_nombre"] == card["lugar_nombre"] == "Finca La Esperanza"


def test_the_story_can_be_searched_by_its_place_name(client, db, narrator):
    code = tell(client, narrator["headers"], lugar_nombre="Finca La Esperanza").json()["codigo"]

    assert "esperanza" in db.historias.find_one({"codigo": code})["busqueda"]


def test_the_teams_stories_can_have_one_too(client, db, admin):
    response = client.post(
        "/api/admin/historias-proyecto",
        headers=admin["headers"],
        json={"client_id": "equipo-000001", "titulo": "El patio", "texto": "Relato.", "epoca": "1960 a 1979", "etiquetas": [], "medios": [], "ubicacion": {"lat": 11.1, "lon": -74.05}, "ubicacion_origen": "mapa", "lugar_nombre": "Patio de secado de los Pérez", "consentimiento": {"aceptado": True, "version": consent.VERSION}},
    )

    assert response.status_code == 201
    assert response.json()["lugar_nombre"] == "Patio de secado de los Pérez"
