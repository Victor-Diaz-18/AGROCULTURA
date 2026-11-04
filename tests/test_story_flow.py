"""Telling a story (F3): it always arrives "en revisión" and never on the map by itself (F6, F1)."""

from datetime import datetime, timezone

import pytest

from tests.factories import JPEG, WEBM_AUDIO, story_payload

YEAR = datetime.now(timezone.utc).year


def send(client, headers, **overrides):
    return client.post("/api/historias", headers=headers, json=story_payload(**overrides))


def upload(client, headers, tipo, content):
    return client.post("/api/medios", headers=headers, data={"tipo": tipo, "duracion_s": "30"}, files={"archivo": ("x", content, "application/octet-stream")}).json()


# ---- the story arrives in review and nowhere else ---------------------------------


def test_a_new_story_is_created_in_review_and_gets_a_consecutive_code(client, narrator):
    first = send(client, narrator["headers"])
    second = send(client, narrator["headers"])

    assert first.status_code == 201
    assert first.json()["codigo"] == f"HIS-{YEAR}-001"
    assert first.json()["estado"] == "revision"
    assert second.json()["codigo"] == f"HIS-{YEAR}-002"


def test_the_server_decides_state_origin_author_and_code_whatever_the_phone_sends(client, db, narrator):
    response = send(
        client,
        narrator["headers"],
        estado="publicada",
        origen="proyecto",
        codigo="HIS-2026-999",
        autor_id="otra-persona",
        narrador_nombre="Alguien Más",
        publicada_en="2026-01-01T00:00:00",
        ejemplo=True,
    )

    assert response.status_code == 201
    stored = db.historias.find_one({"codigo": response.json()["codigo"]})
    assert stored["estado"] == "revision"
    assert stored["origen"] == "comunidad"
    assert str(stored["autor_id"]) == narrator["usuario"]["id"]
    assert stored["narrador_nombre"] == "Ana Beltrán"
    assert stored["codigo"] != "HIS-2026-999"
    assert stored["publicada_en"] is None
    assert stored["ejemplo"] is False


def test_a_new_story_is_not_published_and_counts_as_waiting_for_review(client, db, narrator):
    send(client, narrator["headers"])

    stats = client.get("/api/estadisticas").json()

    assert stats["publicadas"] == 0
    assert stats["en_revision"] == 1
    assert db.historias.count_documents({"estado": "publicada"}) == 0


def test_the_story_is_stored_with_its_location_as_a_geojson_point(client, db, narrator):
    code = send(client, narrator["headers"], ubicacion={"lat": 11.1301, "lon": -74.0868}, ubicacion_origen="gps").json()["codigo"]

    stored = db.historias.find_one({"codigo": code})

    assert stored["ubicacion"] == {"type": "Point", "coordinates": [-74.0868, 11.1301]}  # longitude first
    assert stored["ubicacion_origen"] == "gps"
    assert stored["sector_id"] is None  # far from every sector: "another place of the zone"


def test_the_search_text_has_no_accents_or_capitals(client, db, narrator):
    code = send(client, narrator["headers"], titulo="Cuando llegó la ROYA").json()["codigo"]

    assert db.historias.find_one({"codigo": code})["busqueda"] == "cuando llego la roya ana beltran minca antes de 1960 #cafe"


def test_a_story_told_only_with_the_voice_is_accepted(client, narrator):
    audio = upload(client, narrator["headers"], "audio", WEBM_AUDIO)

    response = send(client, narrator["headers"], texto="", medios=[audio])

    assert response.status_code == 201


def test_photos_and_audio_end_up_in_the_story(client, db, narrator):
    audio = upload(client, narrator["headers"], "audio", WEBM_AUDIO)
    photo = upload(client, narrator["headers"], "foto", JPEG)

    code = send(client, narrator["headers"], medios=[audio, photo]).json()["codigo"]

    kinds = [medio["tipo"] for medio in db.historias.find_one({"codigo": code})["medios"]]
    assert kinds == ["audio", "foto"]


def test_only_narrators_can_tell_stories(client, admin):
    assert client.post("/api/historias", json=story_payload()).status_code == 401
    assert send(client, admin["headers"]).status_code == 403


# ---- what is refused, in plain Spanish ----------------------------------------------


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"texto": "", "medios": []}, "Graba tu historia con tu voz o escríbela."),
        ({"texto": "   "}, "Graba tu historia con tu voz o escríbela."),
        ({"titulo": "ab"}, "Ponle un título"),
        ({"epoca": "Hace mucho"}, "Elige la época"),
        ({"etiquetas": ["#inventada"]}, "ya no está disponible"),
        ({"etiquetas": ["#café", "#finca", "#familia", "#cosecha", "#cocina", "#oficios", "#extra"]}, "hasta 6 etiquetas"),
        ({"client_id": "corto"}, "Identificador de envío"),
        ({"texto": "a" * 5001}, "muy larga"),
    ],
)
def test_incomplete_or_invalid_stories_are_refused_with_a_message_in_spanish(client, narrator, overrides, message):
    response = send(client, narrator["headers"], **overrides)

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_a_location_outside_the_world_is_refused(client, narrator):
    assert send(client, narrator["headers"], ubicacion={"lat": 95, "lon": 0}).status_code == 422


def test_too_many_media_are_refused(client, narrator):
    audio = upload(client, narrator["headers"], "audio", WEBM_AUDIO)

    response = send(client, narrator["headers"], medios=[audio, audio])

    assert response.status_code == 422
    assert "un audio" in response.json()["detail"]


def test_a_story_can_only_point_at_files_the_same_person_uploaded(client, narrator):
    stranger = {"tipo": "foto", "url": "https://store123.public.blob.vercel-storage.com/historias/otra-persona/x.jpg"}
    elsewhere = {"tipo": "foto", "url": "https://evil.example.com/historias/{id}/x.jpg".format(id=narrator["usuario"]["id"])}
    insecure = {"tipo": "foto", "url": f"http://store123.public.blob.vercel-storage.com/historias/{narrator['usuario']['id']}/x.jpg"}

    for medio in (stranger, elsewhere, insecure):
        response = send(client, narrator["headers"], medios=[medio])
        assert response.status_code == 422, medio
        assert "no es válido" in response.json()["detail"]
