"""REMOVABLE with the feature. "Reiniciar datos de ejemplo": only a signed-in administrator, only when
ALLOW_DEMO_RESET is on, and it deletes EVERY story, the real ones too."""

from dataclasses import replace
from datetime import datetime, timezone

import pytest

from lib.auth.service import ensure_demo_narrator
from lib.core.settings import get_settings
from lib.seed.demo import build_examples
from tests.factories import make_story, story_payload

CONFIRM = {"confirmar": True}
CURRENT_YEAR = datetime.now(timezone.utc).year


@pytest.fixture
def reset_on(app, settings):
    """The same server, with the reset allowed."""
    app.dependency_overrides[get_settings] = lambda: replace(settings, allow_demo_reset=True)
    return settings


def reset(client, admin, body=CONFIRM):
    return client.post("/api/admin/reiniciar-ejemplo", headers=admin["headers"], json=body)


# ---- who may, and when -----------------------------------------------------------


def test_it_is_off_unless_the_server_allows_it(client, db, admin):
    db.historias.insert_one(make_story(codigo="HIS-2026-100", titulo="Historia real"))

    response = reset(client, admin)

    assert response.status_code == 403
    assert "desactivado" in response.json()["detail"]
    assert db.historias.count_documents({}) == 1  # nothing was touched


def test_the_app_knows_whether_the_button_should_exist(client, reset_on):
    assert client.get("/api/config").json()["portal"]["reinicio_disponible"] is True


def test_the_app_hides_the_button_when_it_is_off(client):
    assert client.get("/api/config").json()["portal"]["reinicio_disponible"] is False


def test_only_a_signed_in_administrator_can_do_it(client, db, narrator, reset_on):
    db.historias.insert_one(make_story(codigo="HIS-2026-100"))

    visitor = client.post("/api/admin/reiniciar-ejemplo", json=CONFIRM)
    as_narrator = client.post("/api/admin/reiniciar-ejemplo", headers=narrator["headers"], json=CONFIRM)

    assert visitor.status_code == 401
    assert as_narrator.status_code == 403
    assert db.historias.count_documents({}) == 1


@pytest.mark.parametrize("body", [{}, {"confirmar": False}])
def test_it_needs_an_explicit_confirmation(client, db, admin, reset_on, body):
    db.historias.insert_one(make_story(codigo="HIS-2026-100"))

    response = reset(client, admin, body)

    assert response.status_code == 422
    assert db.historias.count_documents({}) == 1


# ---- what it does ------------------------------------------------------------------


def test_it_deletes_every_story_including_real_ones_and_loads_the_twelve_examples(client, db, admin, narrator, reset_on):
    client.post("/api/historias", headers=narrator["headers"], json=story_payload(titulo="Una historia real de una familia"))
    db.historias.insert_one(make_story(codigo="HIS-2026-200", titulo="Otra historia real", estado="publicada", ejemplo=False))

    response = reset(client, admin)

    assert response.status_code == 200
    assert response.json() == {"historias_borradas": 2, "historias_de_ejemplo": 12, "archivos_borrados": 0}
    titles = {story["titulo"] for story in db.historias.find()}
    assert "Una historia real de una familia" not in titles
    assert "Otra historia real" not in titles
    assert db.historias.count_documents({}) == 12
    assert db.historias.count_documents({"ejemplo": True}) == 12


def test_the_examples_give_the_numbers_of_the_approved_design(client, admin, reset_on):
    reset(client, admin)

    stats = client.get("/api/estadisticas").json()

    assert stats["publicadas"] == 7
    assert stats["en_revision"] == 4
    assert stats["rechazadas"] == 1
    assert stats["aprobadas_comunidad"] == 5
    assert stats["por_origen"] == {"comunidad": 5, "proyecto": 2}
    assert stats["sectores_con_historias"] == 4
    assert stats["formatos"] == {"foto": 4, "audio": 5, "video": 2}


def test_the_examples_are_consistent(db, settings):
    examples = build_examples(db, settings)

    assert len({story["codigo"] for story in examples}) == 12
    for story in examples:
        assert story["ejemplo"] is True
        assert story["estado"] in ("publicada", "revision", "rechazada")
        lon, lat = story["ubicacion"]["coordinates"]
        assert -180 <= lon <= 180 and -90 <= lat <= 90
        assert (story["estado"] == "rechazada") == bool(story["motivo_rechazo"])
        assert (story["estado"] == "publicada") == (story["publicada_en"] is not None)
        assert story["busqueda"] == story["busqueda"].lower()
        assert all(medio.get("url") is None for medio in story["medios"])  # there is no real file behind an example


def test_the_examples_are_spread_around_their_sector_and_not_piled_on_one_point(db, settings):
    points = [tuple(story["ubicacion"]["coordinates"]) for story in build_examples(db, settings)]

    assert len(set(points)) == 12


def test_the_next_real_story_continues_after_the_examples(client, admin, narrator, reset_on):
    reset(client, admin)

    sent = client.post("/api/historias", headers=narrator["headers"], json=story_payload()).json()

    expected = "013" if CURRENT_YEAR == 2026 else "001"  # the example codes belong to 2026
    assert sent["codigo"] == f"HIS-{CURRENT_YEAR}-{expected}"


def test_doing_it_twice_leaves_the_same_twelve(client, db, admin, reset_on):
    reset(client, admin)
    second = reset(client, admin)

    assert second.json()["historias_borradas"] == 12
    assert db.historias.count_documents({}) == 12


def test_it_turns_on_the_example_data_label(client, admin, reset_on):
    client.patch("/api/admin/portal", headers=admin["headers"], json={"datos_de_ejemplo": False})

    reset(client, admin)

    assert client.get("/api/config").json()["portal"]["datos_de_ejemplo"] is True


def test_it_deletes_the_files_of_the_stories_it_removes(client, db, admin, reset_on, storage):
    url = "https://store1.public.blob.vercel-storage.com/historias/u1/a-X1.jpg"
    db.historias.insert_one(make_story(codigo="HIS-2026-300", medios=[{"tipo": "foto", "url": url}]))

    response = reset(client, admin)

    assert storage.deleted == [url]
    assert response.json()["archivos_borrados"] == 1


def test_a_file_that_cannot_be_deleted_does_not_undo_the_reset(client, db, admin, reset_on, storage, monkeypatch):
    db.historias.insert_one(make_story(codigo="HIS-2026-300", medios=[{"tipo": "foto", "url": "https://x.public.blob.vercel-storage.com/historias/u/a.jpg"}]))
    monkeypatch.setattr(storage, "delete", lambda urls: (_ for _ in ()).throw(RuntimeError("store down")))

    response = reset(client, admin)

    assert response.status_code == 200
    assert response.json()["archivos_borrados"] == 0
    assert db.historias.count_documents({}) == 12


def test_the_accounts_are_not_touched(client, db, admin, narrator, reset_on):
    users_before = db.usuarios.count_documents({})

    reset(client, admin)

    assert db.usuarios.count_documents({}) == users_before
    assert client.get("/api/auth/yo", headers=narrator["headers"]).status_code == 200


def test_the_demo_narrator_owns_two_of_the_examples_like_ana_does_in_the_design(client, db, admin, settings, app):
    demo = replace(settings, allow_demo_reset=True, demo_narrator_phone="300 111 2233", demo_narrator_pin="2468")
    app.dependency_overrides[get_settings] = lambda: demo
    ensure_demo_narrator(db, demo)
    session = client.post("/api/auth/ingreso", json={"usuario": "3001112233", "clave": "2468"}).json()

    reset(client, admin)

    mine = client.get("/api/historias/mias", headers={"Authorization": f"Bearer {session['token']}"}).json()
    assert sorted(story["codigo"] for story in mine) == ["HIS-2026-007", "HIS-2026-011"]
    assert {story["estado"] for story in mine} == {"publicada", "revision"}
