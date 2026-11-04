"""'Mis historias': what the narrator sees about their own stories (F10, F6)."""

from datetime import datetime, timedelta

from bson import ObjectId

from tests.conftest import bearer, register
from tests.factories import make_story, story_payload


def mine(client, headers):
    return client.get("/api/historias/mias", headers=headers)


def test_it_needs_a_narrator_session(client, admin):
    assert client.get("/api/historias/mias").status_code == 401
    assert mine(client, admin["headers"]).status_code == 403


def test_a_new_narrator_has_no_stories(client, narrator):
    assert mine(client, narrator["headers"]).json() == []


def test_a_narrator_sees_only_their_own_stories_newest_first(client, narrator):
    other = register(client, nombre="Luz Marina", celular="3109998877", pin="1357").json()
    client.post("/api/historias", headers=narrator["headers"], json=story_payload(titulo="La primera"))
    client.post("/api/historias", headers=bearer(other["token"]), json=story_payload(titulo="De otra persona"))
    client.post("/api/historias", headers=narrator["headers"], json=story_payload(titulo="La segunda"))

    titles = [story["titulo"] for story in mine(client, narrator["headers"]).json()]

    assert titles == ["La segunda", "La primera"]


def test_each_story_shows_what_the_design_table_needs(client, narrator):
    client.post("/api/historias", headers=narrator["headers"], json=story_payload(sector_id="la-tagua", epoca="1980 a 1999"))

    story = mine(client, narrator["headers"]).json()[0]

    assert story["codigo"].startswith("HIS-") and story["estado"] == "revision"
    assert story["sector_id"] == "la-tagua" and story["epoca"] == "1980 a 1999"
    assert story["formatos"] == ["Texto"]
    assert story["motivo_rechazo"] is None
    assert story["enviada_en"].endswith("Z")  # UTC, so the browser does not read it as local time


def test_the_formats_follow_the_media_of_the_story(client, db, narrator):
    owner = ObjectId(narrator["usuario"]["id"])
    db.historias.insert_one(make_story(autor_id=owner, medios=[{"tipo": "foto"}, {"tipo": "audio"}]))

    assert mine(client, narrator["headers"]).json()[0]["formatos"] == ["Audio", "Foto"]


def test_a_rejected_story_shows_the_reason(client, db, narrator):
    owner = ObjectId(narrator["usuario"]["id"])
    db.historias.insert_one(
        make_story(autor_id=owner, estado="rechazada", motivo_rechazo="Fuera del tema: no trata de la cultura cafetera")
    )

    story = mine(client, narrator["headers"]).json()[0]

    assert story["estado"] == "rechazada"
    assert story["motivo_rechazo"] == "Fuera del tema: no trata de la cultura cafetera"


def test_every_state_is_listed(client, db, narrator):
    owner = ObjectId(narrator["usuario"]["id"])
    base = datetime(2026, 10, 1)
    for index, estado in enumerate(["borrador", "revision", "publicada", "rechazada"]):
        db.historias.insert_one(make_story(autor_id=owner, estado=estado, creada_en=base + timedelta(days=index), enviada_en=base + timedelta(days=index)))

    states = [story["estado"] for story in mine(client, narrator["headers"]).json()]

    assert states == ["rechazada", "publicada", "revision", "borrador"]
