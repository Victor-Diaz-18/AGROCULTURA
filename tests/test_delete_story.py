"""«Borrar historia» sends a published story to the trash: it leaves the map at once, but the main administrator can bring it
back for 30 days. After that, or with «Borrar para siempre», it is deleted for good with its files. The others cannot."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from lib.auth.constants import ROL_ADMIN, ROL_NARRADOR
from lib.core.clock import utcnow
from lib.stories import review
from tests.conftest import bearer
from tests.factories import make_story

PHOTO = "https://store123.public.blob.vercel-storage.com/historias/u/foto.jpg"
AUDIO = "https://store123.public.blob.vercel-storage.com/historias/u/audio.webm"
CODE = "HIS-2026-090"


def publish(db, **overrides):
    story = make_story(**{"codigo": CODE, "estado": "publicada", "medios": [{"tipo": "foto", "url": PHOTO}, {"tipo": "audio", "url": AUDIO}], **overrides})
    db.historias.insert_one(story)
    return story


def trash(client, admin, code=CODE):
    return client.delete(f"/api/admin/historias/{code}", headers=admin["headers"])


def on_the_map(client, code=CODE) -> bool:
    return any(story["codigo"] == code for story in client.get("/api/historias").json())


def sub_admin(client, admin) -> dict:
    other = {"usuario": "Marta Ríos", "nombre": "Marta Ríos", "clave": "clave-larga-123"}
    assert client.post("/api/admin/administradores", json=other, headers=admin["headers"]).status_code == 201
    token = client.post("/api/auth/ingreso", json={"usuario": other["usuario"], "clave": other["clave"]}).json()["token"]
    return bearer(token)


# ---- sending a story to the trash ------------------------------------------------


def test_deleting_takes_the_story_off_the_map_but_keeps_it_and_its_files(client, admin, db, storage):
    publish(db)

    response = trash(client, admin)

    assert response.status_code == 204
    assert not on_the_map(client)
    assert client.get(f"/api/historias/{CODE}").status_code == 404
    assert client.get(f"/h/{CODE}").status_code == 404  # nor its link to share
    assert client.get("/api/estadisticas").json()["publicadas"] == 0
    assert storage.deleted == []  # the files stay, so it can come back
    kept = db.historias.find_one({"codigo": CODE})
    assert kept["estado"] == "papelera"
    assert kept["borrada_por"] == db.usuarios.find_one({"rol": ROL_ADMIN})["_id"]


def test_it_leaves_the_panel_lists_and_its_narrators_list_too(client, admin, narrator, db):
    author = db.usuarios.find_one({"rol": ROL_NARRADOR})["_id"]
    publish(db, autor_id=author)

    trash(client, admin)

    assert client.get("/api/admin/historias", headers=admin["headers"]).json() == []
    assert client.get("/api/admin/historias?estado=publicada", headers=admin["headers"]).json() == []
    assert client.get("/api/historias/mias", headers=narrator["headers"]).json() == []
    narrators = client.get("/api/admin/narradores", headers=admin["headers"]).json()
    assert narrators[0]["historias"] == 0


@pytest.mark.parametrize("estado", ["revision", "rechazada", "borrador"])
def test_only_published_stories_can_be_deleted(client, admin, db, storage, estado):
    publish(db, estado=estado)

    assert trash(client, admin).status_code == 404
    assert db.historias.find_one({"codigo": CODE})["estado"] == estado


def test_a_story_that_is_not_there_says_so(client, admin):
    assert trash(client, admin, "HIS-2026-999").status_code == 404


def test_a_narrator_or_a_visitor_cannot_delete(client, narrator, db):
    publish(db)

    assert client.delete(f"/api/admin/historias/{CODE}", headers=narrator["headers"]).status_code == 403
    assert client.delete(f"/api/admin/historias/{CODE}").status_code == 401
    assert db.historias.find_one({"codigo": CODE})["estado"] == "publicada"


def test_an_administrator_created_from_the_panel_cannot_delete(client, admin, db, storage):
    publish(db)

    response = client.delete(f"/api/admin/historias/{CODE}", headers=sub_admin(client, admin))

    assert response.status_code == 403
    assert response.json()["detail"] == "Solo el administrador principal puede borrar historias."
    assert db.historias.find_one({"codigo": CODE})["estado"] == "publicada"


# ---- the trash -----------------------------------------------------------------------


def test_the_trash_lists_what_was_deleted_and_until_when_it_can_come_back(client, admin, db):
    publish(db)
    publish(db, codigo="HIS-2026-091", titulo="La otra")
    trash(client, admin)
    trash(client, admin, "HIS-2026-091")

    stories = client.get("/api/admin/papelera", headers=admin["headers"]).json()

    assert [story["codigo"] for story in stories] == ["HIS-2026-091", CODE]  # the last one deleted first
    first = stories[1]
    assert first["medios"][0]["url"] == PHOTO
    deleted = datetime.fromisoformat(first["borrada_en"].rstrip("Z"))
    assert datetime.fromisoformat(first["se_borra_el"].rstrip("Z")) == deleted + timedelta(days=30)


def test_restoring_publishes_it_again_as_it_was(client, admin, narrator, db):
    author = db.usuarios.find_one({"rol": ROL_NARRADOR})["_id"]
    original = publish(db, autor_id=author)
    trash(client, admin)

    response = client.post(f"/api/admin/papelera/{CODE}/recuperar", headers=admin["headers"])

    assert response.status_code == 200
    assert response.json()["estado"] == "publicada"
    assert on_the_map(client)
    assert client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]["codigo"] == CODE
    assert client.get("/api/admin/papelera", headers=admin["headers"]).json() == []
    back = db.historias.find_one({"codigo": CODE})
    assert "borrada_en" not in back and "borrada_por" not in back
    assert back["publicada_en"] == original["publicada_en"].replace(tzinfo=None)  # same date as before, same place in the list


def test_a_story_not_in_the_trash_cannot_be_restored(client, admin, db):
    publish(db)

    assert client.post(f"/api/admin/papelera/{CODE}/recuperar", headers=admin["headers"]).status_code == 404


def test_deleting_for_good_takes_its_files_too(client, admin, db, storage):
    publish(db)
    trash(client, admin)

    response = client.delete(f"/api/admin/papelera/{CODE}", headers=admin["headers"])

    assert response.status_code == 204
    assert db.historias.find_one({"codigo": CODE}) is None
    assert set(storage.deleted) == {PHOTO, AUDIO}


def test_only_a_story_in_the_trash_can_be_deleted_for_good(client, admin, db, storage):
    publish(db)

    assert client.delete(f"/api/admin/papelera/{CODE}", headers=admin["headers"]).status_code == 404
    assert db.historias.find_one({"codigo": CODE})["estado"] == "publicada"
    assert storage.deleted == []


def test_after_30_days_it_goes_for_good_with_its_files(client, admin, db, storage):
    publish(db)
    publish(db, codigo="HIS-2026-091", medios=[])
    trash(client, admin)
    trash(client, admin, "HIS-2026-091")
    db.historias.update_one({"codigo": CODE}, {"$set": {"borrada_en": utcnow() - timedelta(days=30, minutes=1)}})
    db.historias.update_one({"codigo": "HIS-2026-091"}, {"$set": {"borrada_en": utcnow() - timedelta(days=29)}})

    stories = client.get("/api/admin/papelera", headers=admin["headers"]).json()

    assert [story["codigo"] for story in stories] == ["HIS-2026-091"]
    assert db.historias.find_one({"codigo": CODE}) is None
    assert set(storage.deleted) == {PHOTO, AUDIO}


def test_sending_another_story_to_the_trash_also_empties_the_expired_ones(client, admin, db, storage):
    publish(db, estado="papelera", borrada_en=datetime(2026, 1, 1), borrada_por="alguien")
    publish(db, codigo="HIS-2026-091", medios=[])

    trash(client, admin, "HIS-2026-091")

    assert db.historias.find_one({"codigo": CODE}) is None
    assert set(storage.deleted) == {PHOTO, AUDIO}


def test_a_file_that_cannot_be_deleted_does_not_bring_the_story_back(db, monkeypatch):
    publish(db, estado="papelera", borrada_en=datetime(2026, 1, 1), borrada_por="alguien")

    def broken(urls):
        raise RuntimeError("blob caído")

    assert review.delete_forever(db, CODE, delete_files=broken) == {"codigo": CODE, "archivos_borrados": 0}
    assert db.historias.find_one({"codigo": CODE}) is None


def test_only_the_main_administrator_opens_the_trash(client, admin, narrator, db):
    publish(db)
    trash(client, admin)
    other = sub_admin(client, admin)

    response = client.get("/api/admin/papelera", headers=other)
    assert response.status_code == 403
    assert response.json()["detail"] == "Solo el administrador principal puede abrir la papelera."
    assert client.post(f"/api/admin/papelera/{CODE}/recuperar", headers=other).status_code == 403
    assert client.delete(f"/api/admin/papelera/{CODE}", headers=other).status_code == 403
    assert client.get("/api/admin/papelera", headers=narrator["headers"]).status_code == 403
    assert client.get("/api/admin/papelera").status_code == 401
    assert db.historias.find_one({"codigo": CODE})["estado"] == "papelera"
