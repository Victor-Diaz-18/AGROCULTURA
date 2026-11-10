"""An administrator can create other administrators, deactivate and reactivate them. The main one always stays."""

from dataclasses import replace

from lib.auth.admins import list_admins
from lib.auth.service import ensure_admin
from tests.conftest import bearer

NEW = {"usuario": "Marta Ríos", "nombre": "Marta Ríos", "clave": "clave-larga-123"}
URL = "/api/admin/administradores"


def create(client, admin, **overrides):
    return client.post(URL, json={**NEW, **overrides}, headers=admin["headers"])


def sign_in(client, usuario, clave):
    return client.post("/api/auth/ingreso", json={"usuario": usuario, "clave": clave})


def second_admin(client, admin):
    """A second administrator, created by the main one and signed in: (their record, their headers)."""
    record = create(client, admin).json()
    token = sign_in(client, NEW["usuario"], NEW["clave"]).json()["token"]
    return record, bearer(token)


def test_an_administrator_creates_another_who_can_sign_in(client, admin):
    response = create(client, admin)

    assert response.status_code == 201
    body = response.json()
    assert body["usuario"] == "marta ríos"
    assert body["nombre"] == "Marta Ríos"
    assert body["activo"] is True
    assert body["principal"] is False
    assert "clave" not in str(body)

    session = sign_in(client, "MARTA RÍOS", NEW["clave"])
    assert session.status_code == 200
    assert session.json()["usuario"]["rol"] == "administrador"


def test_it_records_who_created_each_administrator_and_when(client, db, admin, settings):
    create(client, admin)

    stored = db.usuarios.find_one({"usuario": "marta ríos"})
    assert stored["creado_por"] == db.usuarios.find_one({"usuario": settings.admin_user})["_id"]
    assert stored["creado_por_usuario"] == settings.admin_user
    assert stored["creado_en"] is not None
    assert stored["clave_hash"].startswith("$2")
    assert NEW["clave"] not in str(stored)

    listed = {row["usuario"]: row for row in client.get(URL, headers=admin["headers"]).json()}
    assert listed["marta ríos"]["creado_por"] == settings.admin_user
    assert listed["marta ríos"]["creado_en"]
    assert listed[settings.admin_user]["creado_por"] is None


def test_the_password_needs_ten_characters_like_the_main_administrator(client, db, admin):
    short = create(client, admin, clave="123456789")
    assert short.status_code == 422
    assert db.usuarios.find_one({"usuario": "marta ríos"}) is None

    assert create(client, admin, clave="1234567890").status_code == 201


def test_a_password_that_is_too_long_is_refused(client, admin):
    assert create(client, admin, clave="a" * 73).status_code == 422


def test_a_user_name_that_looks_like_a_phone_number_is_refused(client, admin):
    assert create(client, admin, usuario="300 123 4567").status_code == 422


def test_a_taken_user_name_is_a_conflict(client, admin, settings):
    assert create(client, admin).status_code == 201

    assert create(client, admin, usuario="  MARTA ríos ").status_code == 409
    assert create(client, admin, usuario=settings.admin_user).status_code == 409


def test_only_administrators_can_manage_administrators(client, narrator, admin):
    record, _ = second_admin(client, admin)

    for method, path in [("get", URL), ("post", URL), ("post", f"{URL}/{record['id']}/desactivar"), ("post", f"{URL}/{record['id']}/reactivar")]:
        assert client.request(method, path, json={}).status_code == 401
        assert client.request(method, path, json=NEW, headers=narrator["headers"]).status_code == 403


def test_the_list_has_everyone_with_their_state(client, admin):
    record, _ = second_admin(client, admin)
    client.post(f"{URL}/{record['id']}/desactivar", headers=admin["headers"])

    rows = client.get(URL, headers=admin["headers"]).json()

    assert [row["principal"] for row in rows] == [True, False]
    assert [row["activo"] for row in rows] == [True, False]
    assert rows[1]["desactivado_en"]


def test_deactivating_closes_the_open_session_and_blocks_new_sign_ins(client, admin):
    record, headers = second_admin(client, admin)
    assert client.get("/api/auth/yo", headers=headers).status_code == 200

    response = client.post(f"{URL}/{record['id']}/desactivar", headers=admin["headers"])

    assert response.status_code == 200
    assert response.json()["activo"] is False
    assert client.get("/api/auth/yo", headers=headers).status_code == 401
    assert client.get(URL, headers=headers).status_code == 401
    assert sign_in(client, NEW["usuario"], NEW["clave"]).status_code == 401


def test_it_records_who_deactivated_and_when(client, db, admin, settings):
    record, _ = second_admin(client, admin)

    body = client.post(f"{URL}/{record['id']}/desactivar", headers=admin["headers"]).json()

    assert body["desactivado_por"] == settings.admin_user
    assert body["desactivado_en"]
    stored = db.usuarios.find_one({"usuario": "marta ríos"})
    assert stored["desactivado_por"] == db.usuarios.find_one({"usuario": settings.admin_user})["_id"]


def test_the_main_administrator_cannot_be_deactivated_even_by_another_administrator(client, db, admin, settings):
    _, headers = second_admin(client, admin)
    main_id = str(db.usuarios.find_one({"usuario": settings.admin_user})["_id"])

    response = client.post(f"{URL}/{main_id}/desactivar", headers=headers)

    assert response.status_code == 403
    assert db.usuarios.find_one({"usuario": settings.admin_user})["activo"] is True
    assert sign_in(client, settings.admin_user, settings.admin_password).status_code == 200


def test_nobody_can_deactivate_their_own_account(client, admin):
    record, headers = second_admin(client, admin)

    assert client.post(f"{URL}/{record['id']}/desactivar", headers=headers).status_code == 403
    assert client.get("/api/auth/yo", headers=headers).status_code == 200


def test_an_administrator_can_deactivate_another_one_who_is_not_the_main(client, admin):
    _, headers = second_admin(client, admin)
    other = create(client, admin, usuario="Luis Gómez", nombre="Luis", clave="otra-clave-larga-1").json()

    assert client.post(f"{URL}/{other['id']}/desactivar", headers=headers).status_code == 200
    rows = {row["usuario"]: row["activo"] for row in client.get(URL, headers=admin["headers"]).json()}
    assert rows["luis gómez"] is False and rows["marta ríos"] is True


def test_deactivating_twice_or_an_unknown_administrator_is_refused(client, admin, narrator):
    record, _ = second_admin(client, admin)
    client.post(f"{URL}/{record['id']}/desactivar", headers=admin["headers"])

    assert client.post(f"{URL}/{record['id']}/desactivar", headers=admin["headers"]).status_code == 409
    assert client.post(f"{URL}/665f1c2e8a1b2c3d4e5f6a7b/desactivar", headers=admin["headers"]).status_code == 404
    assert client.post(f"{URL}/no-es-un-id/desactivar", headers=admin["headers"]).status_code == 404
    # A narrator is not an administrator: it cannot be reached through these routes.
    assert client.post(f"{URL}/{narrator['usuario']['id']}/desactivar", headers=admin["headers"]).status_code == 404


def test_a_deactivated_administrator_can_be_reactivated_and_signs_in_again(client, admin):
    record, _ = second_admin(client, admin)
    client.post(f"{URL}/{record['id']}/desactivar", headers=admin["headers"])

    response = client.post(f"{URL}/{record['id']}/reactivar", headers=admin["headers"])

    assert response.status_code == 200
    body = response.json()
    assert body["activo"] is True
    assert body["desactivado_por"] is None and body["desactivado_en"] is None
    assert sign_in(client, NEW["usuario"], NEW["clave"]).status_code == 200


def test_reactivating_an_active_or_unknown_administrator_is_refused(client, admin):
    record, _ = second_admin(client, admin)

    assert client.post(f"{URL}/{record['id']}/reactivar", headers=admin["headers"]).status_code == 409
    assert client.post(f"{URL}/665f1c2e8a1b2c3d4e5f6a7b/reactivar", headers=admin["headers"]).status_code == 404


def test_the_main_administrator_is_the_one_named_by_the_environment(client, db, admin, settings):
    rows = client.get(URL, headers=admin["headers"]).json()
    assert rows[0]["usuario"] == settings.admin_user and rows[0]["principal"] is True

    # If the variable names someone else, the main one changes with it: nothing is stored to migrate.
    second_admin(client, admin)
    renamed = replace(settings, admin_user=NEW["usuario"])
    marked = {row["usuario"]: row["principal"] for row in list_admins(db, renamed)}
    assert marked == {settings.admin_user: False, "marta ríos": True}


def test_the_environment_restores_the_main_administrator_if_it_was_deactivated_in_the_database(db, settings):
    ensure_admin(db, settings)
    db.usuarios.update_one({"usuario": settings.admin_user}, {"$set": {"activo": False}})

    assert ensure_admin(db, settings) == "actualizado"
    assert db.usuarios.find_one({"usuario": settings.admin_user})["activo"] is True
