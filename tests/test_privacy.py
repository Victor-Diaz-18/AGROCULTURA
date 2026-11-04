"""The public sees only an approximate point of where a story was told; the administrators see the exact one."""

import json
import random

from lib.core.geo import distance_km
from lib.stories.privacy import GRID_DEGREES, public_point
from tests.factories import make_story, story_payload

EXACT = {"lat": 11.08373, "lon": -74.04418}  # somebody's house, say
APPROVAL = {"confirmaciones": ["tema", "territorio", "datos"]}


def publish(client, narrator, admin, point, origin="gps", **overrides):
    sent = client.post("/api/historias", headers=narrator["headers"], json=story_payload(ubicacion=point, ubicacion_origen=origin, **overrides)).json()
    client.post(f"/api/admin/historias/{sent['codigo']}/aprobar", headers=admin["headers"], json=APPROVAL)
    return sent["codigo"]


def test_the_public_point_of_a_gps_story_is_rounded_to_about_500_meters(client, db, narrator, admin):
    code = publish(client, narrator, admin, EXACT, "gps")

    on_the_map = client.get("/api/historias").json()[0]
    card = client.get(f"/api/historias/{code}").json()

    for public in (on_the_map, card):
        assert (public["lat"], public["lon"]) == (11.085, -74.045)
        assert public["aproximada"] is True
        assert distance_km(public["lat"], public["lon"], EXACT["lat"], EXACT["lon"]) < 0.5


def test_a_story_told_by_tapping_the_map_is_rounded_too(client, narrator, admin):
    publish(client, narrator, admin, EXACT, "mapa")

    story = client.get("/api/historias").json()[0]

    assert (story["lat"], story["lon"]) == (11.085, -74.045)
    assert story["aproximada"] is True


def test_the_exact_point_is_kept_for_the_review(client, db, narrator, admin):
    code = publish(client, narrator, admin, EXACT, "gps")

    stored = db.historias.find_one({"codigo": code})
    assert stored["ubicacion"]["coordinates"] == [EXACT["lon"], EXACT["lat"]]
    for_admin = client.get("/api/admin/historias?estado=publicada", headers=admin["headers"]).json()[0]
    assert (for_admin["lat"], for_admin["lon"]) == (EXACT["lat"], EXACT["lon"])


def test_the_exact_numbers_appear_nowhere_in_what_the_public_gets(client, narrator, admin):
    code = publish(client, narrator, admin, EXACT, "gps")

    public = client.get("/api/historias").text + client.get(f"/api/historias/{code}").text

    assert "11.08373" not in public and "74.04418" not in public


def test_a_story_placed_on_a_sector_button_is_shown_where_it_is_the_center_is_not_private(client, narrator, admin):
    center = {"lat": 11.082986, "lon": -74.044951}
    publish(client, narrator, admin, center, "sector")

    story = client.get("/api/historias").json()[0]

    assert (story["lat"], story["lon"]) == (11.082986, -74.044951)
    assert story["aproximada"] is False


def test_the_teams_own_stories_are_shown_where_the_team_put_them(client, db, admin):
    db.historias.insert_one(make_story(codigo="HIS-2026-050", origen="proyecto", ubicacion_origen="mapa", ubicacion={"type": "Point", "coordinates": [-74.04418, 11.08373]}))

    story = client.get("/api/historias").json()[0]

    assert (story["lat"], story["lon"]) == (11.08373, -74.04418)
    assert story["aproximada"] is False


def test_two_houses_in_the_same_cell_look_the_same_and_the_answer_does_not_change_between_calls(client, narrator, admin):
    publish(client, narrator, admin, {"lat": 11.0836, "lon": -74.0441}, "gps")
    publish(client, narrator, admin, {"lat": 11.0864, "lon": -74.0462}, "mapa")

    first = [(s["lat"], s["lon"]) for s in client.get("/api/historias").json()]
    second = [(s["lat"], s["lon"]) for s in client.get("/api/historias").json()]

    assert first == second
    assert len(set(first)) == 1  # the same cell: nobody can tell the two apart


def test_the_rounding_never_moves_a_point_more_than_half_a_cell():
    rng = random.Random(7)
    for _ in range(500):
        lat, lon = rng.uniform(10.74, 11.54), rng.uniform(-74.52, -73.72)
        story = {"origen": "comunidad", "ubicacion_origen": "gps", "ubicacion": {"coordinates": [lon, lat]}}

        public_lat, public_lon, approximate = public_point(story)

        assert approximate
        assert abs(public_lat - lat) <= GRID_DEGREES / 2 + 1e-9
        assert abs(public_lon - lon) <= GRID_DEGREES / 2 + 1e-9


def test_the_narrator_sees_the_approximate_point_in_their_own_story_card_too(client, narrator, admin):
    code = publish(client, narrator, admin, EXACT, "gps")

    card = client.get(f"/api/historias/{code}", headers=narrator["headers"]).json()

    assert (card["lat"], card["lon"]) == (11.085, -74.045)


def test_nothing_private_in_the_list_still(client, narrator, admin):
    publish(client, narrator, admin, EXACT, "gps")

    assert not any(key in json.dumps(client.get("/api/historias").json()) for key in ("autor_id", "client_id", "ubicacion_origen"))
