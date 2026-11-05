"""Stories the team uploads (F12): published at once, marked "del proyecto"."""

from datetime import datetime, timezone

from lib.stories import consent
from tests.factories import JPEG, WEBM_AUDIO

YEAR = datetime.now(timezone.utc).year


def body(**overrides):
    payload = {
        "client_id": "proyecto-0000001",
        "titulo": "El patio donde se secaba el café",
        "texto": "Historia preparada por el equipo a partir de fotos y conversaciones.",
        "epoca": "1960 a 1979",
        "sector_id": "tijereras",
        "etiquetas": ["#finca"],
        "consentimiento": {"aceptado": True, "version": consent.VERSION},  # the team has the authorization of whoever tells it
        "medios": [],
    }
    payload.update(overrides)
    return payload


def create(client, admin, **overrides):
    return client.post("/api/admin/historias-proyecto", headers=admin["headers"], json=body(**overrides))


def upload(client, who, tipo, content):
    return client.post(
        "/api/medios", headers=who["headers"], data={"tipo": tipo}, files={"archivo": ("x", content, "application/octet-stream")}
    ).json()


def test_a_team_story_is_published_at_once_and_marked_as_the_projects(client, db, admin):
    response = create(client, admin)

    assert response.status_code == 201
    story = response.json()
    assert story["estado"] == "publicada"
    assert story["origen"] == "proyecto"
    assert story["narrador_nombre"] == "Equipo AGROCULTURA"
    assert story["codigo"] == f"HIS-{YEAR}-001"
    stored = db.historias.find_one({"codigo": story["codigo"]})
    assert stored["publicada_en"] is not None
    assert stored["ejemplo"] is False
    stats = client.get("/api/estadisticas").json()
    assert stats["publicadas"] == 1
    assert stats["por_origen"] == {"comunidad": 0, "proyecto": 1}
    assert stats["aprobadas_comunidad"] == 0  # not a community approval


def test_it_can_say_who_tells_it(client, admin):
    story = create(client, admin, narrador_nombre="  Doña   Rosa  Pérez ").json()

    assert story["narrador_nombre"] == "Doña Rosa Pérez"


def test_without_a_point_the_place_is_the_center_of_its_sector(client, db, admin):
    story = create(client, admin, sector_id="la-tagua").json()

    stored = db.historias.find_one({"codigo": story["codigo"]})
    assert stored["ubicacion"] == db.sectores.find_one({"_id": "la-tagua"})["centro"]
    assert stored["ubicacion_origen"] == "sector"


def test_with_a_point_that_point_is_kept(client, db, admin):
    story = create(client, admin, ubicacion={"lat": 11.12, "lon": -74.1}, ubicacion_origen="mapa").json()

    stored = db.historias.find_one({"codigo": story["codigo"]})
    assert stored["ubicacion"]["coordinates"] == [-74.1, 11.12]


def test_sending_it_twice_does_not_duplicate_it(client, db, admin):
    first = create(client, admin)
    second = create(client, admin)

    assert first.status_code == 201 and second.status_code == 200
    assert first.json()["codigo"] == second.json()["codigo"]
    assert db.historias.count_documents({}) == 1


def test_the_state_and_origin_are_not_the_clients_to_choose(client, db, admin):
    story = create(client, admin, estado="rechazada", origen="comunidad", ejemplo=True, codigo="HIS-1999-001").json()

    stored = db.historias.find_one({"codigo": story["codigo"]})
    assert (stored["estado"], stored["origen"], stored["ejemplo"]) == ("publicada", "proyecto", False)


def test_the_administrator_can_attach_photos_and_audio_they_uploaded(client, db, admin, storage):
    photo = upload(client, admin, "foto", JPEG)
    audio = upload(client, admin, "audio", WEBM_AUDIO)

    story = create(client, admin, medios=[photo, audio]).json()

    assert story["formatos"] == ["Audio", "Foto"]
    assert client.get("/api/estadisticas").json()["formatos"] == {"foto": 1, "audio": 1, "video": 0}


def test_a_file_somebody_else_uploaded_is_not_accepted(client, admin, narrator):
    theirs = upload(client, narrator, "foto", JPEG)

    response = create(client, admin, medios=[theirs])

    assert response.status_code == 422


def test_it_needs_a_text_or_an_audio(client, admin):
    assert create(client, admin, texto="").status_code == 422


def test_an_audio_alone_is_enough(client, admin):
    audio = upload(client, admin, "audio", WEBM_AUDIO)

    assert create(client, admin, texto="", medios=[audio]).status_code == 201


def test_the_sector_and_the_tags_must_exist(client, admin):
    assert create(client, admin, sector_id="no-existe").status_code == 422
    assert create(client, admin, etiquetas=["#no-existe"]).status_code == 422


def test_a_narrator_cannot_publish_a_team_story(client, narrator):
    response = client.post("/api/admin/historias-proyecto", headers=narrator["headers"], json=body())

    assert response.status_code == 403


def test_the_administrator_is_not_blocked_from_the_media_route(client, admin):
    assert upload(client, admin, "foto", JPEG)["url"].startswith("https://")
