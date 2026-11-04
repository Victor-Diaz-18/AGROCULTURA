"""A story can be anywhere in the zone ("Minca y sectores aledaños"): the sectors are only references."""

import pytest

from tests.factories import story_payload

LA_TAGUA = {"lat": 11.082986, "lon": -74.044951}
SAN_LORENZO = {"lat": 11.116315, "lon": -74.034676}
TIJERERAS = {"lat": 11.109, "lon": -74.1108}  # provisional point
MINCA = {"lat": 11.14, "lon": -74.118}
SOMEWHERE_ELSE = {"lat": 11.2, "lon": -73.95}  # in the zone, far from every sector


def tell(client, headers, point, origin="mapa", **overrides):
    response = client.post("/api/historias", headers=headers, json=story_payload(ubicacion=point, ubicacion_origen=origin, **overrides))
    assert response.status_code == 201, response.json()
    return response.json()["codigo"]


def stored(db, code):
    return db.historias.find_one({"codigo": code})


def test_a_story_far_from_every_sector_is_kept_where_it_was_told_with_no_sector(client, db, narrator):
    code = tell(client, narrator["headers"], SOMEWHERE_ELSE)

    story = stored(db, code)
    assert story["ubicacion"]["coordinates"] == [-73.95, 11.2]
    assert story["sector_id"] is None


def test_a_story_near_a_sector_belongs_to_it(client, db, narrator):
    code = tell(client, narrator["headers"], {"lat": 11.0835, "lon": -74.045})

    assert stored(db, code)["sector_id"] == "la-tagua"


def test_the_nearest_sector_wins_when_two_are_close(client, db, narrator):
    closer_to_san_lorenzo = {"lat": 11.1105, "lon": -74.0355}
    closer_to_la_tagua = {"lat": 11.0905, "lon": -74.0445}

    assert stored(db, tell(client, narrator["headers"], closer_to_san_lorenzo))["sector_id"] == "san-lorenzo"
    assert stored(db, tell(client, narrator["headers"], closer_to_la_tagua))["sector_id"] == "la-tagua"


def test_the_sector_comes_from_the_point_not_from_what_the_phone_says(client, db, narrator):
    lying = tell(client, narrator["headers"], LA_TAGUA, sector_id="minca")
    claiming = tell(client, narrator["headers"], SOMEWHERE_ELSE, sector_id="la-tagua")
    nonsense = tell(client, narrator["headers"], MINCA, sector_id="atlantida")

    assert stored(db, lying)["sector_id"] == "la-tagua"
    assert stored(db, claiming)["sector_id"] is None
    assert stored(db, nonsense)["sector_id"] == "minca"  # a made-up sector is ignored, not an error


def test_a_story_without_a_sector_at_all_is_accepted(client, db, narrator):
    payload = story_payload(ubicacion=SOMEWHERE_ELSE, ubicacion_origen="gps")
    payload.pop("sector_id")

    response = client.post("/api/historias", headers=narrator["headers"], json=payload)

    assert response.status_code == 201
    assert stored(db, response.json()["codigo"])["sector_id"] is None


def test_choosing_a_sector_puts_the_story_in_it_even_when_its_point_is_not_confirmed(client, db, narrator):
    code = tell(client, narrator["headers"], TIJERERAS, origin="sector")

    assert stored(db, code)["sector_id"] == "tijereras"


def test_a_point_that_is_not_confirmed_does_not_label_the_stories_around_it(client, db, narrator):
    near = {"lat": TIJERERAS["lat"] + 0.002, "lon": TIJERERAS["lon"]}

    code = tell(client, narrator["headers"], near, origin="mapa")

    assert stored(db, code)["sector_id"] != "tijereras"


def test_the_story_without_a_sector_shows_up_everywhere_without_breaking_anything(client, db, narrator, admin):
    code = tell(client, narrator["headers"], SOMEWHERE_ELSE)
    client.post(f"/api/admin/historias/{code}/aprobar", headers=admin["headers"], json={"confirmaciones": ["tema", "territorio", "datos"]})

    mine = client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]
    on_the_map = client.get("/api/historias").json()[0]
    card = client.get(f"/api/historias/{code}").json()
    for_admin = client.get("/api/admin/historias?estado=publicada", headers=admin["headers"]).json()[0]

    assert mine["sector_id"] is on_the_map["sector_id"] is card["sector_id"] is for_admin["sector_id"] is None
    assert (on_the_map["lat"], on_the_map["lon"]) == (11.2, -73.95)


def test_only_stories_with_a_sector_count_for_the_sectors_with_stories(client, db, narrator, admin):
    ids = [tell(client, narrator["headers"], point) for point in (SOMEWHERE_ELSE, {"lat": 11.0835, "lon": -74.045})]
    for code in ids:
        client.post(f"/api/admin/historias/{code}/aprobar", headers=admin["headers"], json={"confirmaciones": ["tema", "territorio", "datos"]})

    stats = client.get("/api/estadisticas").json()

    assert stats["publicadas"] == 2
    assert stats["sectores_con_historias"] == 1


# ---- the team's stories ---------------------------------------------------------------


def team(client, admin, **overrides):
    body = {
        "client_id": "equipo-000001",
        "titulo": "Un camino de herradura",
        "texto": "Relato.",
        "epoca": "1960 a 1979",
        "etiquetas": [],
        "medios": [],
    }
    body.update(overrides)
    return client.post("/api/admin/historias-proyecto", headers=admin["headers"], json=body)


def test_a_team_story_can_be_anywhere_in_the_zone_too(client, db, admin):
    response = team(client, admin, ubicacion=SOMEWHERE_ELSE, ubicacion_origen="mapa")

    assert response.status_code == 201
    story = stored(db, response.json()["codigo"])
    assert story["ubicacion"]["coordinates"] == [-73.95, 11.2]
    assert story["sector_id"] is None


def test_a_team_story_with_a_point_near_a_sector_is_in_that_sector(client, db, admin):
    story = stored(db, team(client, admin, ubicacion={"lat": 11.1165, "lon": -74.035}, ubicacion_origen="mapa").json()["codigo"])

    assert story["sector_id"] == "san-lorenzo"


def test_a_team_story_that_names_only_a_sector_goes_to_its_center(client, db, admin):
    story = stored(db, team(client, admin, sector_id="la-tagua").json()["codigo"])

    assert story["ubicacion"] == db.sectores.find_one({"_id": "la-tagua"})["centro"]
    assert story["sector_id"] == "la-tagua"


@pytest.mark.parametrize("overrides", [{}, {"sector_id": "atlantida"}])
def test_a_team_story_must_say_where_it_happened(client, admin, overrides):
    response = team(client, admin, **overrides)

    assert response.status_code == 422
    assert "dónde ocurrió" in response.json()["detail"]
