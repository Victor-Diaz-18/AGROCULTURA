"""Portal options (F7): name, "avisar al narrador", tags. Sectors stay read-only."""

import pytest

from tests.factories import story_payload


def patch(client, admin, **changes):
    return client.patch("/api/admin/portal", headers=admin["headers"], json=changes)


def config(client):
    return client.get("/api/config").json()


def add_tag(client, admin, name):
    return client.post("/api/admin/etiquetas", headers=admin["headers"], json={"nombre": name})


def remove_tag(client, admin, name):
    return client.delete("/api/admin/etiquetas", headers=admin["headers"], params={"nombre": name})


# ---- name and options ----------------------------------------------------------


def test_the_name_changes_for_everybody(client, admin):
    response = patch(client, admin, nombre="  Memoria   Cafetera  ")

    assert response.status_code == 200
    assert response.json()["nombre"] == "Memoria Cafetera"
    assert config(client)["portal"]["nombre"] == "Memoria Cafetera"


@pytest.mark.parametrize("name", ["", " ", "A", "x" * 61])
def test_a_name_that_is_too_short_or_too_long_is_refused(client, admin, name):
    assert patch(client, admin, nombre=name).status_code == 422
    assert config(client)["portal"]["nombre"] == "AGROCULTURA"


def test_the_options_are_changed_one_at_a_time(client, admin):
    patch(client, admin, avisar_rechazo=True)
    patch(client, admin, datos_de_ejemplo=False)

    portal = config(client)["portal"]
    assert portal["avisar_rechazo"] is True
    assert portal["datos_de_ejemplo"] is False
    assert portal["nombre"] == "AGROCULTURA"  # untouched


def test_a_request_with_nothing_to_change_changes_nothing(client, admin):
    before = config(client)["portal"]

    assert patch(client, admin).status_code == 200
    assert config(client)["portal"] == before


def test_unknown_options_are_ignored(client, admin):
    patch(client, admin, nombre="Otro nombre", modo_admin=True, jwt_secret="x")

    assert "modo_admin" not in config(client)["portal"]


def test_a_narrator_cannot_change_the_portal(client, narrator):
    response = client.patch("/api/admin/portal", headers=narrator["headers"], json={"nombre": "Hackeado"})

    assert response.status_code == 403
    assert config(client)["portal"]["nombre"] == "AGROCULTURA"


def test_there_is_no_route_to_change_the_sectors(app):
    paths = app.openapi()["paths"]

    assert not [path for path in paths if "sector" in path and path.startswith("/api/admin")]


# ---- tags ------------------------------------------------------------------------


def test_a_tag_is_added_in_the_shape_the_design_uses(client, admin):
    response = add_tag(client, admin, "Café Viejo")

    assert response.status_code == 201
    assert response.json()[-1] == "#café-viejo"
    assert config(client)["etiquetas"][-1] == "#café-viejo"


def test_the_hash_is_added_when_missing_and_kept_when_there(client, admin):
    assert add_tag(client, admin, "trilla").json()[-1] == "#trilla"
    assert add_tag(client, admin, "#arriería").json()[-1] == "#arriería"


@pytest.mark.parametrize("name", ["", "   ", "#", "##doble", "con!símbolo", "#" + "a" * 30])
def test_a_tag_with_symbols_or_the_wrong_length_is_refused(client, admin, name):
    before = config(client)["etiquetas"]

    assert add_tag(client, admin, name).status_code == 422
    assert config(client)["etiquetas"] == before


def test_a_tag_cannot_be_added_twice(client, admin):
    assert add_tag(client, admin, "#café").status_code == 409
    assert add_tag(client, admin, "CAFÉ").status_code == 409


def test_a_tag_is_removed(client, admin):
    response = remove_tag(client, admin, "#cocina")

    assert response.status_code == 200
    assert "#cocina" not in response.json()
    assert "#cocina" not in config(client)["etiquetas"]


def test_removing_a_tag_that_is_not_there_says_so(client, admin):
    assert remove_tag(client, admin, "#nunca-existio").status_code == 404


def test_there_cannot_be_endless_tags(client, admin):
    added = 0
    while True:
        response = add_tag(client, admin, f"#etiqueta{added}")
        if response.status_code != 201:
            break
        added += 1

    assert response.status_code == 422
    assert len(config(client)["etiquetas"]) == 40


def test_a_new_tag_can_be_chosen_by_narrators_and_a_removed_one_cannot(client, admin, narrator):
    add_tag(client, admin, "#arriería")
    remove_tag(client, admin, "#oficios")

    with_new = client.post("/api/historias", headers=narrator["headers"], json=story_payload(etiquetas=["#arriería"]))
    with_old = client.post("/api/historias", headers=narrator["headers"], json=story_payload(etiquetas=["#oficios"]))

    assert with_new.status_code == 201
    assert with_old.status_code == 422


def test_stories_that_already_have_a_removed_tag_keep_it(client, db, admin, narrator):
    sent = client.post("/api/historias", headers=narrator["headers"], json=story_payload(etiquetas=["#cocina"])).json()

    remove_tag(client, admin, "#cocina")

    assert db.historias.find_one({"codigo": sent["codigo"]})["etiquetas"] == ["#cocina"]


def test_a_narrator_cannot_touch_the_tags(client, narrator):
    assert client.post("/api/admin/etiquetas", headers=narrator["headers"], json={"nombre": "#x"}).status_code == 403
    assert client.delete("/api/admin/etiquetas", headers=narrator["headers"], params={"nombre": "#café"}).status_code == 403
