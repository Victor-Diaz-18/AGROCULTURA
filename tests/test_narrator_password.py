"""A family forgets its password: any administrator writes a new one for the account and tells it to them.

It becomes their password, the sessions the account had open stop working, and the account records who changed it and when.
Nobody else can do it, and nobody ever reads a password back.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from lib.auth.phone import normalize_phone
from lib.core.security import create_token, hash_secret
from tests.conftest import NARRATOR, bearer
from tests.factories import make_story

LIST = "/api/admin/narradores"
NEW_PASSWORD = "cafe-4821"


def reset_url(user_id: str) -> str:
    return f"{LIST}/{user_id}/clave"


def sign_in(client, usuario, clave):
    return client.post("/api/auth/ingreso", json={"usuario": usuario, "clave": clave})


def narrator_id(db) -> str:
    return str(db.usuarios.find_one({"usuario": "ana beltrán"})["_id"])


def second_admin_headers(client, admin) -> dict:
    other = {"usuario": "Marta Ríos", "nombre": "Marta Ríos", "clave": "clave-larga-123"}
    assert client.post("/api/admin/administradores", json=other, headers=admin["headers"]).status_code == 201
    return bearer(sign_in(client, other["usuario"], other["clave"]).json()["token"])


# ---- finding the account -------------------------------------------------------


def test_an_administrator_sees_every_narrator_with_how_many_stories_they_sent(client, db, admin, narrator):
    user = db.usuarios.find_one({"usuario": "ana beltrán"})
    db.historias.insert_many([make_story(autor_id=user["_id"]), make_story(autor_id=user["_id"], estado="revision")])
    db.historias.insert_one(make_story())  # somebody else's

    response = client.get(LIST, headers=admin["headers"])

    assert response.status_code == 200
    [row] = response.json()  # the administrator is not in the list
    assert row["id"] == str(user["_id"])
    assert row["nombre"] == "Ana Beltrán"
    assert row["usuario"] == "ana beltrán"
    assert row["historias"] == 2
    assert row["clave_restablecida_por"] is None
    assert "clave" not in response.text.replace("clave_restablecida", "")  # never the password, nor its hash


def test_the_list_comes_by_name(client, db, admin, narrator):
    client.post("/api/auth/registro", json={"usuario": "Berta Díaz", "clave": "123456"})
    client.post("/api/auth/registro", json={"usuario": "adela ruiz", "clave": "123456"})

    names = [row["nombre"] for row in client.get(LIST, headers=admin["headers"]).json()]

    assert names == ["adela ruiz", "Ana Beltrán", "Berta Díaz"]


# ---- giving a new password -----------------------------------------------------


def test_the_new_password_works_and_the_old_one_does_not(client, db, admin, narrator):
    response = client.post(reset_url(narrator_id(db)), json={"clave": NEW_PASSWORD}, headers=admin["headers"])

    assert response.status_code == 200
    assert response.json()["nombre"] == "Ana Beltrán"
    assert NEW_PASSWORD not in response.text
    assert sign_in(client, NARRATOR["usuario"], NARRATOR["clave"]).status_code == 401
    session = sign_in(client, NARRATOR["usuario"], NEW_PASSWORD)
    assert session.status_code == 200
    assert client.get("/api/auth/yo", headers=bearer(session.json()["token"])).status_code == 200


def test_it_records_who_gave_the_new_password_and_when(client, db, admin, narrator, settings):
    response = client.post(reset_url(narrator_id(db)), json={"clave": NEW_PASSWORD}, headers=admin["headers"])

    stored = db.usuarios.find_one({"usuario": "ana beltrán"})
    main = db.usuarios.find_one({"usuario": settings.admin_user})
    assert stored["clave_restablecida_por"] == main["_id"]
    assert stored["clave_restablecida_por_usuario"] == settings.admin_user
    assert stored["clave_restablecida_en"] is not None
    assert response.json()["clave_restablecida_por"] == settings.admin_user
    assert client.get(LIST, headers=admin["headers"]).json()[0]["clave_restablecida_por"] == settings.admin_user


def test_the_sessions_opened_before_stop_working(client, db, admin, narrator, settings):
    user = db.usuarios.find_one({"usuario": "ana beltrán"})
    lost_phone = bearer(create_token(user, settings, now=datetime.now(timezone.utc) - timedelta(minutes=5)))
    assert client.get("/api/auth/yo", headers=lost_phone).status_code == 200

    client.post(reset_url(str(user["_id"])), json={"clave": NEW_PASSWORD}, headers=admin["headers"])

    refused = client.get("/api/auth/yo", headers=lost_phone)
    assert refused.status_code == 401
    assert refused.json()["detail"] == "Tu contraseña cambió. Ingresa de nuevo con la contraseña nueva."
    assert client.get("/api/historias/mias", headers=lost_phone).status_code == 401


def test_a_family_locked_out_by_wrong_tries_can_come_in_at_once(client, db, admin, narrator, settings):
    for _ in range(settings.login_max_attempts + 1):
        sign_in(client, NARRATOR["usuario"], "no-es-esta")
    assert sign_in(client, NARRATOR["usuario"], NARRATOR["clave"]).status_code == 429

    client.post(reset_url(narrator_id(db)), json={"clave": NEW_PASSWORD}, headers=admin["headers"])

    assert sign_in(client, NARRATOR["usuario"], NEW_PASSWORD).status_code == 200


def test_an_account_made_with_a_mobile_number_gets_a_new_password_too(client, db, admin, settings):
    phone = normalize_phone("300 123 4567")
    db.usuarios.insert_one(
        {
            "nombre": "Rosa Pérez",
            "usuario": phone,
            "rol": "narrador",
            "clave_hash": hash_secret("1234", settings.bcrypt_rounds),
            "activo": True,
            "creado_en": datetime(2026, 9, 1),
        }
    )
    [row] = client.get(LIST, headers=admin["headers"]).json()
    assert row["usuario"] == phone  # what the family signs in with

    client.post(reset_url(row["id"]), json={"clave": NEW_PASSWORD}, headers=admin["headers"])

    assert sign_in(client, "300 123 4567", NEW_PASSWORD).status_code == 200


def test_an_administrator_created_from_the_panel_can_do_it_too(client, db, admin, narrator):
    headers = second_admin_headers(client, admin)

    assert client.get(LIST, headers=headers).status_code == 200
    assert client.post(reset_url(narrator_id(db)), json={"clave": NEW_PASSWORD}, headers=headers).status_code == 200
    assert db.usuarios.find_one({"usuario": "ana beltrán"})["clave_restablecida_por_usuario"] == "marta ríos"


# ---- what is refused -----------------------------------------------------------


def test_the_password_follows_the_same_rule_as_when_the_account_is_made(client, db, admin, narrator):
    short = client.post(reset_url(narrator_id(db)), json={"clave": "12345"}, headers=admin["headers"])
    assert short.status_code == 422
    assert short.json()["detail"] == "La contraseña debe tener al menos 6 caracteres."

    long = client.post(reset_url(narrator_id(db)), json={"clave": "ñ" * 40}, headers=admin["headers"])  # 80 bytes
    assert long.status_code == 422

    assert sign_in(client, NARRATOR["usuario"], NARRATOR["clave"]).status_code == 200  # nothing changed


def test_only_narrator_accounts(client, db, admin, settings):
    main = db.usuarios.find_one({"usuario": settings.admin_user})

    for user_id in (str(main["_id"]), "64b7f0c2a1b2c3d4e5f60718", "no-es-un-id"):
        response = client.post(reset_url(user_id), json={"clave": NEW_PASSWORD}, headers=admin["headers"])
        assert response.status_code == 404
        assert response.json()["detail"] == "No encontramos a ese narrador."
    assert sign_in(client, settings.admin_user, settings.admin_password).status_code == 200


def test_a_narrator_or_a_visitor_cannot(client, db, narrator):
    user_id = narrator_id(db)

    assert client.get(LIST, headers=narrator["headers"]).status_code == 403
    assert client.get(LIST).status_code == 401
    assert client.post(reset_url(user_id), json={"clave": NEW_PASSWORD}, headers=narrator["headers"]).status_code == 403
    assert client.post(reset_url(user_id), json={"clave": NEW_PASSWORD}).status_code == 401
    assert sign_in(client, NARRATOR["usuario"], NARRATOR["clave"]).status_code == 200
