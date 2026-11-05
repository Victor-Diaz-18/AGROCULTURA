"""Consent, "publicar sin mi nombre" and "sin ubicación": what is kept, what the public may read, and what it never gets."""

import json
from datetime import timedelta

import pytest

from lib.core.clock import utcnow
from lib.stories import consent
from tests.factories import make_story, story_payload

AUTHORIZATION = {"aceptado": True, "version": consent.VERSION}
APPROVAL = {"confirmaciones": ["tema", "territorio", "datos", "consentimiento"]}

REAL_NAME = "Ana Beltrán"  # the narrator of the `narrator` fixture
EXACT = {"lat": 11.08373, "lon": -74.04418}  # somebody's house, say
REFERENCE = "Finca Los Mangos, camino al río"  # what a narrator without a place writes as a reference


def send(client, who, **overrides):
    overrides.setdefault("consentimiento", AUTHORIZATION)
    return client.post("/api/historias", headers=who["headers"], json=story_payload(**overrides))


def publish(client, narrator, admin, **overrides):
    sent = send(client, narrator, **overrides)
    assert sent.status_code == 201, sent.text
    code = sent.json()["codigo"]
    assert client.post(f"/api/admin/historias/{code}/aprobar", headers=admin["headers"], json=APPROVAL).status_code == 200
    return code


def team_story(client, admin, **overrides):
    payload = {
        "client_id": "proyecto-0000001",
        "titulo": "El patio donde se secaba el café",
        "texto": "Historia preparada por el equipo.",
        "epoca": "1960 a 1979",
        "sector_id": "tijereras",
        "narrador_nombre": "Doña Carmen Quintero",
        "consentimiento": AUTHORIZATION,
        **overrides,
    }
    return client.post("/api/admin/historias-proyecto", headers=admin["headers"], json=payload)


def everything_public(client, code):
    """The raw text of every public answer about a story: what the people who use the platform can get."""
    return client.get("/api/historias").text + client.get(f"/api/historias/{code}").text


# ---- consent ------------------------------------------------------------------------------------------------------


def test_the_consent_is_kept_with_the_story_with_its_version_text_and_date(client, db, narrator):
    code = send(client, narrator).json()["codigo"]

    record = db.historias.find_one({"codigo": code})["consentimiento"]

    assert record["version"] == consent.VERSION
    assert record["variante"] == "aproximada_con_nombre"
    assert record["de"] == "narrador"
    assert abs(record["aceptado_en"] - utcnow()) < timedelta(minutes=1)


@pytest.mark.parametrize(
    "anonima, modo, variant",
    [
        (False, "aproximada", "aproximada_con_nombre"),
        (True, "aproximada", "aproximada_sin_nombre"),
        (False, "ninguna", "ninguna_con_nombre"),
        (True, "ninguna", "ninguna_sin_nombre"),
    ],
)
def test_the_text_accepted_is_the_one_for_what_the_narrator_chose(client, db, narrator, anonima, modo, variant):
    code = send(client, narrator, anonima=anonima, ubicacion_modo=modo).json()["codigo"]

    assert db.historias.find_one({"codigo": code})["consentimiento"]["variante"] == variant


def test_the_moment_of_acceptance_is_the_phones_when_it_is_believable(client, db, narrator):
    two_days_ago = utcnow() - timedelta(days=2)
    code = send(client, narrator, consentimiento={**AUTHORIZATION, "aceptado_en": two_days_ago.isoformat() + "Z"}).json()["codigo"]

    kept = db.historias.find_one({"codigo": code})["consentimiento"]["aceptado_en"]
    assert abs(kept - two_days_ago) < timedelta(seconds=1)  # MongoDB keeps milliseconds
    assert kept < utcnow() - timedelta(days=1)  # it is the phone's moment, not the server's


@pytest.mark.parametrize("offset", [timedelta(days=3), -timedelta(days=200)])
def test_a_moment_from_the_future_or_from_long_ago_is_replaced_by_the_servers(client, db, narrator, offset):
    claimed = utcnow() + offset
    code = send(client, narrator, consentimiento={**AUTHORIZATION, "aceptado_en": claimed.isoformat() + "Z"}).json()["codigo"]

    assert abs(db.historias.find_one({"codigo": code})["consentimiento"]["aceptado_en"] - utcnow()) < timedelta(minutes=1)


def test_a_consent_that_was_not_accepted_is_refused_with_a_message(client, narrator):
    response = send(client, narrator, consentimiento={**AUTHORIZATION, "aceptado": False})

    assert response.status_code == 422
    assert response.json()["detail"] == "Para enviar tu historia debes autorizar que se publique."


def test_a_consent_for_an_older_text_is_refused_so_the_person_sees_the_new_one(client, narrator):
    response = send(client, narrator, consentimiento={**AUTHORIZATION, "version": "1900-01-1"})

    assert response.status_code == 422
    assert "cambió" in response.json()["detail"]


def test_while_it_is_not_demanded_a_story_without_consent_still_goes_in_without_a_record(client, db, narrator, monkeypatch):
    monkeypatch.setattr(consent, "EXIGIR_CONSENTIMIENTO", False)  # the switch exists, and it is on

    response = client.post("/api/historias", headers=narrator["headers"], json=story_payload(consentimiento=None))

    assert response.status_code == 201
    assert db.historias.find_one({"codigo": response.json()["codigo"]})["consentimiento"] is None


def test_a_story_without_consent_cannot_be_sent(client, db, narrator):
    assert consent.EXIGIR_CONSENTIMIENTO is True  # demanded by default

    response = client.post("/api/historias", headers=narrator["headers"], json=story_payload(consentimiento=None))

    assert response.status_code == 422
    assert response.json()["detail"] == "Para enviar tu historia debes autorizar que se publique."
    assert db.historias.count_documents({}) == 0
    assert client.post("/api/historias", headers=narrator["headers"], json={k: v for k, v in story_payload().items() if k != "consentimiento"}).status_code == 422  # nor with the field missing


def test_a_story_with_consent_goes_in(client, narrator):
    assert send(client, narrator).status_code == 201


def test_the_teams_stories_need_the_authorization_of_whoever_tells_them(client, db, admin):
    refused = team_story(client, admin, consentimiento=None)
    accepted = team_story(client, admin)

    assert refused.status_code == 422
    assert accepted.status_code == 201
    assert db.historias.find_one({"codigo": accepted.json()["codigo"]})["consentimiento"]["de"] == "equipo"


def test_the_administrators_see_which_text_was_accepted_and_when(client, narrator, admin):
    send(client, narrator, anonima=True)

    story = client.get("/api/admin/historias", headers=admin["headers"]).json()[0]

    assert story["consentimiento"]["version"] == consent.VERSION
    assert story["consentimiento"]["variante"] == "aproximada_sin_nombre"
    assert story["consentimiento"]["de"] == "narrador"
    assert story["consentimiento"]["aceptado_en"].endswith("Z")


def test_the_public_config_serves_the_four_texts_of_each_audience(client):
    texts = client.get("/api/config").json()["consentimiento"]

    assert texts["version"] == consent.VERSION
    for audience in ("narrador", "equipo"):
        assert set(texts[audience]) == {"aproximada_con_nombre", "aproximada_sin_nombre", "ninguna_con_nombre", "ninguna_sin_nombre"}
        assert len({item["texto"] for item in texts[audience].values()}) == 4  # four different texts
    narrator = texts["narrador"]
    assert "con mi nombre" in narrator["aproximada_con_nombre"]["texto"] and "aproximado" in narrator["aproximada_con_nombre"]["texto"]
    assert "sin mi nombre" in narrator["aproximada_sin_nombre"]["texto"] and "aproximado" in narrator["aproximada_sin_nombre"]["texto"]
    assert "con mi nombre" in narrator["ninguna_con_nombre"]["texto"] and "sin ubicación" in narrator["ninguna_con_nombre"]["texto"]
    assert "sin mi nombre" in narrator["ninguna_sin_nombre"]["texto"] and "sin ubicación" in narrator["ninguna_sin_nombre"]["texto"]


# ---- "publicar sin mi nombre" -------------------------------------------------------------------------------------


def test_the_public_never_gets_the_name_of_an_anonymous_story(client, narrator, admin):
    code = publish(client, narrator, admin, anonima=True)

    listed = client.get("/api/historias").json()[0]
    card = client.get(f"/api/historias/{code}").json()

    for public in (listed, card):
        assert public["narrador_nombre"] == "Narrador anónimo"
        assert public["anonima"] is True
    assert REAL_NAME not in everything_public(client, code)  # in no field of any public answer


def test_a_story_with_a_name_shows_it(client, narrator, admin):
    code = publish(client, narrator, admin)

    assert client.get(f"/api/historias/{code}").json()["narrador_nombre"] == REAL_NAME


def test_the_real_name_is_kept_for_the_administrators_and_for_its_narrator(client, narrator, admin):
    send(client, narrator, anonima=True)

    for_admin = client.get("/api/admin/historias", headers=admin["headers"]).json()[0]
    mine = client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]

    assert for_admin["narrador_nombre"] == REAL_NAME
    assert for_admin["anonima"] is True
    assert mine["anonima"] is True


def test_what_the_search_matches_does_not_include_the_real_name_of_an_anonymous_story(client, db, narrator):
    code = send(client, narrator, anonima=True).json()["codigo"]

    assert "beltran" not in db.historias.find_one({"codigo": code})["busqueda"]
    assert "anonimo" in db.historias.find_one({"codigo": code})["busqueda"]


def test_the_team_can_publish_a_story_without_the_name_of_whoever_tells_it(client, admin):
    code = team_story(client, admin, anonima=True).json()["codigo"]

    assert "Carmen" not in everything_public(client, code)
    assert client.get(f"/api/historias/{code}").json()["narrador_nombre"] == "Narrador anónimo"
    assert client.get("/api/admin/historias", headers=admin["headers"]).json()[0]["narrador_nombre"] == "Doña Carmen Quintero"


def test_stories_from_before_this_option_existed_show_their_narrator(client):
    from lib.stories.service import story_for_map  # noqa: F401  (documents without the field)

    story = make_story(narrador_nombre="Rosa Elena Pérez")  # no `anonima` key at all

    assert story_for_map(story)["narrador_nombre"] == "Rosa Elena Pérez"
    assert story_for_map(story)["anonima"] is False


# ---- "sin ubicación" ----------------------------------------------------------------------------------------------


def no_place(**overrides):
    """What a narrator who chose "Sin ubicación" sends (an older screen or a direct call could still send a point)."""
    return {"ubicacion_modo": "ninguna", "lugar_nombre": REFERENCE, **overrides}


def test_no_point_is_kept_for_a_story_without_a_place_even_if_one_was_sent(client, db, narrator):
    response = send(client, narrator, **no_place(ubicacion=EXACT, ubicacion_origen="gps", sector_id="minca"))

    assert response.status_code == 201
    stored = db.historias.find_one({"codigo": response.json()["codigo"]})
    assert "ubicacion" not in stored  # not even an empty one: the geospatial index skips what has no point
    assert stored["ubicacion_modo"] == "ninguna"
    assert stored["ubicacion_origen"] is None
    assert stored["sector_id"] is None
    assert stored["lugar_nombre"] == REFERENCE  # kept: the administrators use it to review


def test_the_public_never_gets_coordinates_nor_the_reference_of_a_story_without_a_place(client, narrator, admin):
    code = publish(client, narrator, admin, **no_place(ubicacion=EXACT, ubicacion_origen="gps", sector_id="minca"))

    listed = client.get("/api/historias").json()[0]
    card = client.get(f"/api/historias/{code}").json()

    for public in (listed, card):
        assert public["con_ubicacion"] is False
        assert public["lat"] is None and public["lon"] is None
        assert public["sector_id"] is None
        assert public["lugar_nombre"] is None
        assert public["aproximada"] is False
    raw = everything_public(client, code)
    for secret in ("11.08373", "-74.04418", "11.085", "-74.045", "Los Mangos", "camino al río", "minca", "Minca"):
        assert secret not in raw, secret


def test_a_story_without_a_place_is_on_the_published_list_with_its_card(client, narrator, admin):
    with_place = publish(client, narrator, admin)
    without_place = publish(client, narrator, admin, titulo="Una historia sin lugar", **no_place())

    codes = [story["codigo"] for story in client.get("/api/historias").json()]

    assert set(codes) == {with_place, without_place}
    assert client.get(f"/api/historias/{without_place}").status_code == 200


def test_the_administrators_see_the_reference_of_a_story_without_a_place_and_no_point(client, narrator, admin):
    send(client, narrator, **no_place(ubicacion=EXACT, ubicacion_origen="gps"))

    story = client.get("/api/admin/historias", headers=admin["headers"]).json()[0]

    assert story["ubicacion_modo"] == "ninguna"
    assert story["lugar_nombre"] == REFERENCE
    assert story["lat"] is None and story["lon"] is None


def test_the_narrator_sees_what_they_wrote_as_the_reference_in_their_own_list(client, narrator):
    send(client, narrator, **no_place())

    mine = client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]

    assert mine["ubicacion_modo"] == "ninguna"
    assert mine["lugar_nombre"] == REFERENCE


def test_with_a_place_a_point_is_required_and_the_message_says_how_to_go_without_one(client, narrator):
    response = send(client, narrator, ubicacion=None, ubicacion_origen=None)

    assert response.status_code == 422
    assert "Elige dónde ocurrió" in response.json()["detail"]
    assert "Sin ubicación" in response.json()["detail"]


def test_with_a_place_the_public_point_is_still_rounded_to_about_500_meters(client, narrator, admin):
    code = publish(client, narrator, admin, ubicacion=EXACT, ubicacion_origen="gps")

    card = client.get(f"/api/historias/{code}").json()

    assert (card["lat"], card["lon"]) == (11.085, -74.045)
    assert card["aproximada"] is True
    assert card["con_ubicacion"] is True


def test_the_team_can_publish_a_story_without_a_place_too(client, db, admin):
    code = team_story(client, admin, **no_place(sector_id="tijereras")).json()["codigo"]

    stored = db.historias.find_one({"codigo": code})
    assert "ubicacion" not in stored and stored["sector_id"] is None
    public = client.get(f"/api/historias/{code}").json()
    assert public["con_ubicacion"] is False and public["lugar_nombre"] is None


def test_a_document_without_a_point_never_breaks_the_public_answers(client, db):
    db.historias.insert_one({k: v for k, v in make_story().items() if k != "ubicacion"})  # old or broken: no point, no mode

    listed = client.get("/api/historias").json()

    assert listed[0]["con_ubicacion"] is False
    assert listed[0]["lat"] is None


def test_a_story_without_a_place_can_be_approved_like_any_other(client, narrator, admin):
    code = send(client, narrator, **no_place()).json()["codigo"]

    response = client.post(f"/api/admin/historias/{code}/aprobar", headers=admin["headers"], json=APPROVAL)

    assert response.status_code == 200
    assert response.json()["estado"] == "publicada"


# ---- the counters -------------------------------------------------------------------------------------------------


def test_published_counts_every_story_and_says_how_many_have_no_place(client, narrator, admin):
    publish(client, narrator, admin)
    publish(client, narrator, admin, **no_place())
    publish(client, narrator, admin, **no_place())

    stats = client.get("/api/estadisticas").json()

    assert stats["publicadas"] == 3
    assert stats["sin_ubicacion"] == 2
    assert stats["aprobadas_comunidad"] == 3


def test_sectors_with_stories_only_counts_stories_on_the_map_so_a_hidden_reference_does_not_leak(client, db):
    db.historias.insert_many(
        [
            make_story(sector_id="minca"),
            make_story(sector_id="la-tagua", ubicacion_modo="ninguna", ubicacion=None),  # its sector is a secret
        ]
    )

    stats = client.get("/api/estadisticas").json()

    assert stats["publicadas"] == 2
    assert stats["sectores_con_historias"] == 1  # Minca; La Tagua would give the hidden story away
    assert stats["sin_ubicacion"] == 1


def test_a_story_waiting_for_review_is_not_counted_as_one_without_a_place(client, narrator):
    send(client, narrator, **no_place())

    assert client.get("/api/estadisticas").json()["sin_ubicacion"] == 0


# ---- the name of the farm or brand ---------------------------------------------------------------------------------


def test_the_name_of_the_farm_is_optional_cleaned_and_shown_on_the_card(client, narrator, admin):
    code = publish(client, narrator, admin, finca_nombre="  Café   Don Aurelio ")

    assert client.get(f"/api/historias/{code}").json()["finca_nombre"] == "Café Don Aurelio"
    assert client.get("/api/historias").json()[0]["finca_nombre"] == "Café Don Aurelio"


def test_without_a_farm_name_the_field_is_empty(client, narrator, admin):
    code = publish(client, narrator, admin, finca_nombre="   ")

    assert client.get(f"/api/historias/{code}").json()["finca_nombre"] is None


def test_a_farm_name_that_is_too_long_is_refused_with_a_message(client, narrator):
    response = send(client, narrator, finca_nombre="F" * 81)

    assert response.status_code == 422
    assert "finca" in response.json()["detail"]


def test_the_json_that_carries_the_texts_is_valid_utf8_and_the_api_answers_what_it_says(client):
    from pathlib import Path

    raw = json.loads((Path(consent.__file__).with_name("consentimiento.json")).read_text(encoding="utf-8"))

    assert client.get("/api/config").json()["consentimiento"] == raw
