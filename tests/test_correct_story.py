"""Before publishing, the team can correct the title and the text of a story (typos, a clearer title). What the narrator
wrote is kept for the team, and the narrator reads in «Mis historias» that the team corrected it."""

from __future__ import annotations

from lib.auth.constants import ROL_ADMIN, ROL_NARRADOR
from tests.conftest import bearer
from tests.factories import make_story

CODE = "HIS-2026-070"
CHECKS = {"confirmaciones": ["tema", "territorio", "datos", "consentimiento"]}


def waiting(db, **overrides):
    story = make_story(**{"codigo": CODE, "estado": "revision", "titulo": "El camino de mulas", "texto": "Antes de la carretera el cafe bajaba en mula.", "publicada_en": None, **overrides})
    db.historias.insert_one(story)
    return story


def correct(client, admin, titulo="El camino de las mulas", texto="Antes de la carretera, el café bajaba en mula.", code=CODE):
    return client.patch(f"/api/admin/historias/{code}", json={"titulo": titulo, "texto": texto}, headers=admin["headers"])


def test_the_team_corrects_the_title_and_the_text_and_the_original_is_kept(client, admin, db):
    waiting(db)

    response = correct(client, admin)

    assert response.status_code == 200
    story = response.json()
    assert story["titulo"] == "El camino de las mulas"
    assert story["texto"] == "Antes de la carretera, el café bajaba en mula."
    assert story["estado"] == "revision"  # it still waits for the decision
    assert story["correccion"]["titulo"] == "El camino de mulas"
    assert story["correccion"]["texto"] == "Antes de la carretera el cafe bajaba en mula."
    main = db.usuarios.find_one({"rol": ROL_ADMIN})
    assert story["correccion"]["por"] == (main.get("nombre") or main["usuario"])
    assert story["correccion"]["en"].endswith("Z")


def test_the_search_finds_it_by_its_new_title(client, admin, db):
    waiting(db)
    correct(client, admin, titulo="La trilladora de don Pedro")

    assert "trilladora" in db.historias.find_one({"codigo": CODE})["busqueda"]
    assert "camino" not in db.historias.find_one({"codigo": CODE})["busqueda"]


def test_a_second_correction_keeps_what_the_narrator_wrote(client, admin, db):
    waiting(db)
    correct(client, admin)

    story = correct(client, admin, titulo="El camino de las mulas viejas").json()

    assert story["titulo"] == "El camino de las mulas viejas"
    assert story["correccion"]["titulo"] == "El camino de mulas"


def test_putting_it_back_as_it_was_is_no_correction(client, admin, db):
    waiting(db)
    correct(client, admin)

    story = correct(client, admin, titulo="El camino de mulas", texto="Antes de la carretera el cafe bajaba en mula.").json()

    assert story["correccion"] is None


def test_the_narrator_is_told_once_it_is_published_and_the_public_reads_the_correction(client, admin, narrator, db):
    author = db.usuarios.find_one({"rol": ROL_NARRADOR})["_id"]
    waiting(db, autor_id=author)
    correct(client, admin, texto="Antes de la carretera el cafe bajaba en mula.")  # only the title changes

    assert client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]["corregido"] == []  # not yet: it waits
    assert client.post(f"/api/admin/historias/{CODE}/aprobar", json=CHECKS, headers=admin["headers"]).status_code == 200

    mine = client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]
    assert mine["titulo"] == "El camino de las mulas"
    assert mine["corregido"] == ["titulo"]
    card = client.get(f"/api/historias/{CODE}").json()
    assert card["titulo"] == "El camino de las mulas"
    assert "correccion" not in card  # the public never sees what was written before


def test_a_story_without_a_correction_tells_the_narrator_nothing(client, admin, narrator, db):
    author = db.usuarios.find_one({"rol": ROL_NARRADOR})["_id"]
    waiting(db, autor_id=author)
    client.post(f"/api/admin/historias/{CODE}/aprobar", json=CHECKS, headers=admin["headers"])

    assert client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]["corregido"] == []


def test_only_a_story_that_waits_for_review_can_be_corrected(client, admin, db):
    for estado in ("publicada", "rechazada"):
        db.historias.delete_many({})
        waiting(db, estado=estado)
        response = correct(client, admin)
        assert response.status_code == 409
        assert response.json()["detail"] == "Esta historia ya se revisó: solo se corrige mientras espera revisión."
        assert db.historias.find_one({"codigo": CODE})["titulo"] == "El camino de mulas"


def test_a_story_of_the_project_or_one_that_does_not_exist_cannot_be_corrected(client, admin, db):
    waiting(db, origen="proyecto")

    assert correct(client, admin).status_code == 409
    assert correct(client, admin, code="HIS-2026-999").status_code == 404


def test_a_story_told_only_with_the_voice_keeps_no_text(client, admin, db):
    waiting(db, texto="", medios=[{"tipo": "audio", "url": "https://store123.public.blob.vercel-storage.com/a.webm"}])

    response = correct(client, admin, texto="Un texto que el narrador no escribió.")
    assert response.status_code == 422
    assert response.json()["detail"] == "Esta historia no tiene texto escrito: solo se puede corregir el título."

    assert correct(client, admin, texto="").json()["titulo"] == "El camino de las mulas"  # the title alone, yes


def test_the_text_cannot_be_left_empty(client, admin, db):
    waiting(db)

    response = correct(client, admin, texto="   ")

    assert response.status_code == 422
    assert response.json()["detail"] == "El texto no puede quedar vacío. Si la historia no sirve, recházala."


def test_the_title_follows_the_same_rule_as_when_it_was_written(client, admin, db):
    waiting(db)

    assert correct(client, admin, titulo="ab").status_code == 422
    assert correct(client, admin, titulo="  El   camino  ").json()["titulo"] == "El camino"


def test_nothing_else_of_the_story_changes(client, admin, db):
    waiting(db)

    client.patch(f"/api/admin/historias/{CODE}", json={"titulo": "Otro título", "texto": "Otro texto.", "epoca": "Antes de 1960", "estado": "publicada"}, headers=admin["headers"])

    story = db.historias.find_one({"codigo": CODE})
    assert story["epoca"] == "1960 a 1979"
    assert story["estado"] == "revision"


def test_any_administrator_can_correct_but_not_a_narrator_or_a_visitor(client, admin, narrator, db):
    waiting(db)
    other = {"usuario": "Marta Ríos", "nombre": "Marta Ríos", "clave": "clave-larga-123"}
    client.post("/api/admin/administradores", json=other, headers=admin["headers"])
    token = client.post("/api/auth/ingreso", json={"usuario": other["usuario"], "clave": other["clave"]}).json()["token"]

    assert correct(client, narrator).status_code == 403
    assert client.patch(f"/api/admin/historias/{CODE}", json={"titulo": "Otro título", "texto": "x"}).status_code == 401
    response = correct(client, {"headers": bearer(token)})
    assert response.status_code == 200
    assert response.json()["correccion"]["por"] == "Marta Ríos"
