"""The main administrator deletes a published story: it leaves the map and its files are deleted too. The others cannot."""

from __future__ import annotations

import pytest

from tests.conftest import bearer
from tests.factories import make_story

PHOTO = "https://store123.public.blob.vercel-storage.com/historias/u/foto.jpg"
AUDIO = "https://store123.public.blob.vercel-storage.com/historias/u/audio.webm"


def publish(db, **overrides):
    story = make_story(**{"codigo": "HIS-2026-090", "estado": "publicada", "medios": [{"tipo": "foto", "url": PHOTO}, {"tipo": "audio", "url": AUDIO}], **overrides})
    db.historias.insert_one(story)
    return story


def test_an_administrator_deletes_a_published_story_and_its_files(client, admin, db, storage):
    publish(db)

    response = client.delete("/api/admin/historias/HIS-2026-090", headers=admin["headers"])

    assert response.status_code == 204
    assert db.historias.find_one({"codigo": "HIS-2026-090"}) is None
    assert client.get("/api/historias/HIS-2026-090").status_code == 404
    assert all(story["codigo"] != "HIS-2026-090" for story in client.get("/api/historias").json())
    assert set(storage.deleted) == {PHOTO, AUDIO}


@pytest.mark.parametrize("estado", ["revision", "rechazada", "borrador"])
def test_only_published_stories_can_be_deleted(client, admin, db, storage, estado):
    publish(db, estado=estado)

    assert client.delete("/api/admin/historias/HIS-2026-090", headers=admin["headers"]).status_code == 404
    assert db.historias.find_one({"codigo": "HIS-2026-090"}) is not None
    assert storage.deleted == []


def test_a_story_that_is_not_there_says_so(client, admin):
    assert client.delete("/api/admin/historias/HIS-2026-999", headers=admin["headers"]).status_code == 404


def test_a_narrator_or_a_visitor_cannot_delete(client, narrator, db):
    publish(db)

    assert client.delete("/api/admin/historias/HIS-2026-090", headers=narrator["headers"]).status_code == 403
    assert client.delete("/api/admin/historias/HIS-2026-090").status_code == 401
    assert db.historias.find_one({"codigo": "HIS-2026-090"}) is not None


def test_an_administrator_created_from_the_panel_cannot_delete(client, admin, db, storage):
    publish(db)
    other = {"usuario": "Marta Ríos", "nombre": "Marta Ríos", "clave": "clave-larga-123"}
    assert client.post("/api/admin/administradores", json=other, headers=admin["headers"]).status_code == 201
    token = client.post("/api/auth/ingreso", json={"usuario": other["usuario"], "clave": other["clave"]}).json()["token"]

    response = client.delete("/api/admin/historias/HIS-2026-090", headers=bearer(token))

    assert response.status_code == 403
    assert response.json()["detail"] == "Solo el administrador principal puede borrar historias."
    assert db.historias.find_one({"codigo": "HIS-2026-090"}) is not None
    assert storage.deleted == []


def test_a_file_that_cannot_be_deleted_does_not_bring_the_story_back(client, admin, db, storage, monkeypatch):
    publish(db)

    def broken(urls):
        raise RuntimeError("blob caído")

    monkeypatch.setattr(storage, "delete", broken)

    assert client.delete("/api/admin/historias/HIS-2026-090", headers=admin["headers"]).status_code == 204
    assert db.historias.find_one({"codigo": "HIS-2026-090"}) is None
