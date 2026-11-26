"""While a story waits for review its narrator can change all of it; the team corrects what is written in it; and the team
changes its own stories, published or not."""

from __future__ import annotations

from lib.stories import consent
from tests.factories import JPEG, story_payload

AUTHORIZED = {"aceptado": True, "version": consent.VERSION}


def upload(client, who, tipo="foto", content=JPEG):
    return client.post(
        "/api/medios", headers=who["headers"], data={"tipo": tipo}, files={"archivo": ("x", content, "application/octet-stream")}
    ).json()


def tell(client, narrator, **overrides):
    response = client.post("/api/historias", headers=narrator["headers"], json=story_payload(**{"epoca": None, "anio_desde": 1955, **overrides}))
    assert response.status_code == 201, response.text
    return response.json()["codigo"]


def edit(client, narrator, code, **overrides):
    body = story_payload(**{"epoca": None, "anio_desde": 1955, **overrides})
    return client.put(f"/api/historias/{code}", headers=narrator["headers"], json=body)


# ---- the narrator -----------------------------------------------------------------


def test_the_narrator_gets_their_story_as_they_told_it(client, narrator):
    code = tell(client, narrator, anio_desde=1950, anio_hasta=1960, finca_nombre="Finca La Esperanza")

    story = client.get(f"/api/historias/mias/{code}", headers=narrator["headers"]).json()

    assert (story["anio_desde"], story["anio_hasta"], story["anio_escrito"]) == (1950, 1960, True)
    assert story["finca_nombre"] == "Finca La Esperanza"
    assert (story["lat"], story["lon"]) == (11.14, -74.118)  # the exact point: it is their own story
    assert story["estado"] == "revision"


def test_the_narrator_changes_everything_while_it_waits_and_it_stays_in_review(client, narrator, db):
    code = tell(client, narrator)

    response = edit(
        client,
        narrator,
        code,
        titulo="El camino viejo de las mulas",
        texto="Otra versión, más completa.",
        anio_desde=1940,
        anio_hasta=1948,
        ubicacion_modo="ninguna",
        lugar_nombre="Cerca de la quebrada",
        anonima=True,
        etiquetas=["#finca"],
    )

    assert response.status_code == 200, response.text
    story = db.historias.find_one({"codigo": code})
    assert story["estado"] == "revision"
    assert (story["titulo"], story["texto"], story["epoca"]) == ("El camino viejo de las mulas", "Otra versión, más completa.", "1940 a 1948")
    assert story["anonima"] is True
    assert story["ubicacion_modo"] == "ninguna" and "ubicacion" not in story and story["sector_id"] is None
    assert story["consentimiento"]["variante"] == consent.variant(anonima=True, modo="ninguna")  # authorized again, for this way
    assert story["editada_en"] is not None


def test_the_authorization_is_given_again_when_editing(client, narrator):
    code = tell(client, narrator)

    response = edit(client, narrator, code, consentimiento=None)

    assert response.status_code == 422


def test_photos_taken_out_are_deleted_and_new_ones_are_kept(client, narrator, db, storage):
    old = upload(client, narrator)
    code = tell(client, narrator, medios=[old])
    new = upload(client, narrator)

    response = edit(client, narrator, code, medios=[new])

    assert response.status_code == 200
    assert [medio["url"] for medio in db.historias.find_one({"codigo": code})["medios"]] == [new["url"]]
    assert storage.deleted == [old["url"]]


def test_once_reviewed_it_cannot_be_changed(client, narrator, db):
    code = tell(client, narrator)
    db.historias.update_one({"codigo": code}, {"$set": {"estado": "publicada"}})

    assert client.get(f"/api/historias/mias/{code}", headers=narrator["headers"]).status_code == 409
    response = edit(client, narrator, code)
    assert response.status_code == 409
    assert "ya no se puede editar" in response.json()["detail"]


def test_nobody_else_can_see_or_change_it(client, narrator, db):
    code = tell(client, narrator)
    other = client.post("/api/auth/registro", json={"usuario": "Otra Persona", "clave": "123456"}).json()
    headers = {"Authorization": f"Bearer {other['token']}"}

    assert client.get(f"/api/historias/mias/{code}", headers=headers).status_code == 404
    assert client.put(f"/api/historias/{code}", headers=headers, json=story_payload(epoca=None, anio_desde=1955)).status_code == 404


def test_what_the_team_had_corrected_is_forgotten_when_the_narrator_edits_it(client, narrator, admin, db):
    code = tell(client, narrator)
    client.patch(f"/api/admin/historias/{code}", headers=admin["headers"], json={"titulo": "Título del equipo", "texto": "Texto del equipo."})

    edit(client, narrator, code, titulo="Mi título de nuevo")

    assert "correccion" not in db.historias.find_one({"codigo": code})


# ---- the team corrects a story waiting for review -------------------------------------


def test_the_team_corrects_years_names_and_tags_and_the_original_is_kept(client, narrator, admin, db):
    code = tell(client, narrator, anio_desde=1955, finca_nombre="Finca Vieja", etiquetas=["#café"])

    response = client.patch(
        f"/api/admin/historias/{code}",
        headers=admin["headers"],
        json={
            "titulo": "El camino de mulas",
            "texto": "Antes de que hubiera carretera, el café bajaba en mula.",
            "anio_desde": 1950,
            "anio_hasta": 1958,
            "lugar_nombre": "El camino viejo",
            "finca_nombre": "Finca La Vieja",
            "etiquetas": ["#café", "#finca"],
        },
    )

    assert response.status_code == 200, response.text
    story = response.json()
    assert (story["epoca"], story["finca_nombre"], story["etiquetas"]) == ("1950 a 1958", "Finca La Vieja", ["#café", "#finca"])
    assert story["correccion"]["epoca"] == "1955"
    assert story["correccion"]["finca_nombre"] == "Finca Vieja"
    assert set(story["correccion"]["campos"]) == {"epoca", "lugar_nombre", "finca_nombre", "etiquetas"}
    kept = db.historias.find_one({"codigo": code})
    assert kept["anonima"] is False and kept["ubicacion"]["coordinates"] == [-74.118, 11.14]  # what the narrator authorized


def test_the_team_cannot_write_years_that_make_no_sense(client, narrator, admin):
    code = tell(client, narrator)

    response = client.patch(
        f"/api/admin/historias/{code}", headers=admin["headers"], json={"titulo": "Un título", "texto": "Un texto.", "anio_desde": 1990, "anio_hasta": 1980}
    )

    assert response.status_code == 422


# ---- the team changes its own stories ----------------------------------------------------


def project_body(**overrides):
    payload = {
        "client_id": "proyecto-0000009",
        "titulo": "El patio donde se secaba el café",
        "texto": "Historia preparada por el equipo.",
        "anio_desde": 1965,
        "sector_id": "tijereras",
        "etiquetas": ["#finca"],
        "consentimiento": AUTHORIZED,
        "medios": [],
    }
    return {**payload, **overrides}


def test_the_team_changes_a_published_story_of_its_own_and_it_stays_published(client, admin, db):
    code = client.post("/api/admin/historias-proyecto", headers=admin["headers"], json=project_body()).json()["codigo"]

    response = client.put(
        f"/api/admin/historias-proyecto/{code}",
        headers=admin["headers"],
        json=project_body(titulo="El patio del café", anio_desde=1962, anio_hasta=1970, narrador_nombre="Familia Pérez"),
    )

    assert response.status_code == 200, response.text
    story = response.json()
    assert (story["titulo"], story["epoca"], story["narrador_nombre"], story["estado"]) == ("El patio del café", "1962 a 1970", "Familia Pérez", "publicada")
    assert db.historias.find_one({"codigo": code})["publicada_en"] is not None


def test_a_story_of_a_family_is_not_edited_as_a_team_story(client, narrator, admin):
    code = tell(client, narrator)

    response = client.put(f"/api/admin/historias-proyecto/{code}", headers=admin["headers"], json=project_body())

    assert response.status_code == 409


def test_a_narrator_cannot_edit_a_team_story(client, narrator, admin):
    code = client.post("/api/admin/historias-proyecto", headers=admin["headers"], json=project_body()).json()["codigo"]

    assert client.put(f"/api/admin/historias-proyecto/{code}", headers=narrator["headers"], json=project_body()).status_code == 403
    assert edit(client, narrator, code).status_code == 404
