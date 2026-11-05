"""Registration and sign-in: narrators sign up with a user name and a password; everybody signs in the same way."""

from dataclasses import replace
from datetime import timedelta

import jwt
import pytest

from lib.auth.service import ensure_demo_narrator
from lib.core.clock import utcnow
from tests.conftest import NARRATOR, bearer, register

LOGIN = "/api/auth/ingreso"


def sign_in(client, usuario="Ana Beltrán", clave="482193"):
    """Everybody signs in the same way: a user name and a password."""
    return client.post(LOGIN, json={"usuario": usuario, "clave": clave})


def legacy_narrator(db, settings, phone="3005550192", pin="4821", name="Rosa Elena Pérez"):
    """A narrator who signed up before user names: the mobile number is the user and a 4 to 6 digit PIN the password."""
    ensure_demo_narrator(
        db, replace(settings, demo_narrator_phone=phone, demo_narrator_pin=pin, demo_narrator_name=name)
    )


# ---- sign up ---------------------------------------------------------------


def test_a_new_narrator_registers_and_is_signed_in_at_once(client):
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["usuario"]["nombre"] == "Ana Beltrán"  # the name their stories will show
    assert body["usuario"]["rol"] == "narrador"
    assert body["token"]
    assert client.get("/api/auth/yo", headers=bearer(body["token"])).json()["nombre"] == "Ana Beltrán"


def test_only_a_user_name_and_a_password_are_asked_for(client, db):
    response = client.post("/api/auth/registro", json={"usuario": "rosa_elena", "clave": "mi cafetal"})

    assert response.status_code == 201
    stored = db.usuarios.find_one({"usuario": "rosa_elena"})
    assert set(stored) == {"_id", "nombre", "usuario", "rol", "clave_hash", "activo", "creado_en", "ultimo_ingreso"}  # no phone, no e-mail


def test_the_password_is_stored_hashed_and_never_in_plain_text(client, db):
    register(client, clave="mi clave 482193")

    stored = db.usuarios.find_one({"usuario": "ana beltrán"})
    assert stored["clave_hash"].startswith("$2")  # bcrypt
    assert "482193" not in str(stored)


def test_the_user_name_is_kept_as_written_but_found_without_capitals_or_extra_spaces(client, db):
    register(client, usuario="  Rosa   Elena  PÉREZ ")

    stored = db.usuarios.find_one({"usuario": "rosa elena pérez"})
    assert stored["nombre"] == "Rosa Elena PÉREZ"  # single spaces, as typed otherwise


def test_the_same_user_name_written_in_other_ways_is_taken(client):
    register(client, usuario="Ana Beltrán")

    again = register(client, usuario="  ana   BELTRÁN ", clave="otra clave")

    assert again.status_code == 409
    assert again.json()["detail"] == "Ese nombre de usuario ya está en uso. Elige otro."


def test_accents_typed_in_two_ways_are_the_same_name(client):
    register(client, usuario="Ana Beltra\u0301n")  # a + combining accent

    assert register(client, usuario="Ana Beltr\u00e1n").status_code == 409  # the single letter á


def test_the_administrators_name_is_not_available(client, settings, admin):
    response = register(client, usuario=settings.admin_user.upper())

    assert response.status_code == 409


@pytest.mark.parametrize("password", ["abcdef", "123456", "      ", "contraseña con espacios y ñ", "😀😀😀😀😀😀", "a" * 72])
def test_any_password_of_six_or_more_characters_is_accepted(client, password):
    assert register(client, usuario="Familia", clave=password).status_code == 201
    assert sign_in(client, usuario="Familia", clave=password).status_code == 200  # exactly as typed, spaces included


def test_a_password_is_not_trimmed_nor_case_insensitive(client):
    register(client, clave="  Café Fuerte ")

    assert sign_in(client, clave="  Café Fuerte ").status_code == 200
    assert sign_in(client, clave="Café Fuerte").status_code == 401
    assert sign_in(client, clave="  café fuerte ").status_code == 401


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"clave": ""}, "al menos 6 caracteres"),  # empty
        ({"clave": "12345"}, "al menos 6 caracteres"),
        ({"clave": "ab"}, "al menos 6 caracteres"),
        ({"clave": "x" * 73}, "demasiado larga"),  # bcrypt only reads 72 bytes
        ({"clave": "é" * 40}, "demasiado larga"),  # 80 bytes
        ({"usuario": ""}, "Escribe un nombre de usuario"),
        ({"usuario": "   "}, "Escribe un nombre de usuario"),
        ({"usuario": "Al"}, "Escribe un nombre de usuario"),
        ({"usuario": "A" * 41}, "Escribe un nombre de usuario"),
        ({"usuario": "300 555 0192"}, "no puede incluir un número de celular"),
        ({"usuario": "+57 300 555 0192"}, "no puede incluir un número de celular"),
        ({"usuario": "Rosa 3005550192"}, "no puede incluir un número de celular"),
    ],
)
def test_invalid_sign_up_data_is_rejected_with_a_message_in_spanish(client, overrides, message):
    response = register(client, **overrides)

    assert response.status_code == 422
    assert message in response.json()["detail"]
    assert response.json()["code"] == "datos_invalidos"


def test_a_password_of_exactly_six_characters_is_the_shortest_accepted(client):
    assert register(client, usuario="Familia Uno", clave="12345").status_code == 422
    assert register(client, usuario="Familia Uno", clave="123456").status_code == 201


def test_a_validation_error_never_echoes_the_password_back(client):
    response = register(client, clave="abc-secret-that-is-way-too-long-" + "x" * 200)

    assert response.status_code == 422
    assert "abc-secret" not in response.text


def test_a_missing_field_gets_a_clear_message(client):
    response = client.post("/api/auth/registro", json={"usuario": "Ana"})

    assert response.status_code == 422
    assert response.json()["detail"] == "Falta completar un dato obligatorio."


# ---- sign in ---------------------------------------------------------------


def test_a_narrator_signs_in_with_the_user_name_and_the_password(client):
    register(client)

    response = sign_in(client, usuario="ana beltrán")  # capitals do not matter in the name

    assert response.status_code == 200
    assert response.json()["usuario"]["nombre"] == "Ana Beltrán"


def test_a_narrator_who_signed_up_with_a_phone_and_a_pin_still_signs_in_the_same_way(client, db, settings):
    legacy_narrator(db, settings)

    by_number = sign_in(client, usuario="3005550192", clave="4821")
    written_differently = sign_in(client, usuario="+57 (300) 555-0192", clave="4821")

    assert by_number.status_code == written_differently.status_code == 200
    person = by_number.json()["usuario"]
    assert (person["nombre"], person["rol"]) == ("Rosa Elena Pérez", "narrador")
    assert sign_in(client, usuario="3005550192", clave="0000").status_code == 401


def test_a_wrong_password_and_an_unknown_user_get_the_same_answer(client):
    register(client)

    wrong_password = sign_in(client, clave="000000")
    unknown_user = sign_in(client, usuario="Luz Marina")

    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json()["detail"] == unknown_user.json()["detail"] == "Usuario o contraseña incorrectos."


def test_every_failure_says_the_same_whoever_is_signing_in(client, db, settings, admin):
    register(client)
    legacy_narrator(db, settings)
    answers = [
        sign_in(client, clave="000000"),  # a narrator, wrong password
        sign_in(client, usuario="Luz Marina"),  # a name nobody chose
        sign_in(client, usuario=settings.admin_user, clave="no-es-esa-clave"),  # the administrator, wrong password
        sign_in(client, usuario="3005550192", clave="0000"),  # an older account, wrong PIN
        sign_in(client, usuario="3109998877", clave="4821"),  # a phone nobody registered
    ]

    assert {answer.status_code for answer in answers} == {401}
    assert {answer.json()["detail"] for answer in answers} == {"Usuario o contraseña incorrectos."}


def test_the_account_says_what_kind_of_person_it_is_so_nobody_has_to(client, settings, admin):
    register(client)

    narrator = sign_in(client)
    administrator = sign_in(client, usuario=settings.admin_user, clave=settings.admin_password)

    assert narrator.json()["usuario"]["rol"] == "narrador"
    assert administrator.json()["usuario"]["rol"] == "administrador"


def test_the_user_name_is_not_case_sensitive_but_the_password_is(client, settings, admin):
    ok = sign_in(client, usuario=f"  {settings.admin_user.upper()} ", clave=settings.admin_password)
    wrong_case = sign_in(client, usuario=settings.admin_user, clave=settings.admin_password.swapcase())

    assert ok.status_code == 200
    assert wrong_case.status_code == 401


def test_a_role_sent_by_an_older_version_of_the_app_is_ignored(client, settings, admin):
    register(client)

    # An old screen asking for the administrator door with a narrator's data: it is still a narrator.
    as_admin = client.post(LOGIN, json={"rol": "administrador", "usuario": "Ana Beltrán", "clave": "482193"})
    # ...and one asking for the narrator door with the administrator's data: it is still the administrator.
    as_narrator = client.post(
        LOGIN, json={"rol": "narrador", "usuario": settings.admin_user, "clave": settings.admin_password}
    )

    assert as_admin.json()["usuario"]["rol"] == "narrador"
    assert as_narrator.json()["usuario"]["rol"] == "administrador"


def test_a_narrator_cannot_become_an_administrator_by_asking(client):
    register(client)
    token = sign_in(client).json()["token"]

    assert client.get("/api/admin/historias", headers=bearer(token)).status_code == 403


def test_five_failed_attempts_lock_the_account_even_for_the_right_password(client):
    register(client)
    for _ in range(5):
        assert sign_in(client, clave="000000").status_code == 401

    locked = sign_in(client)  # the right password, but too many attempts

    assert locked.status_code == 429
    assert "Demasiados intentos" in locked.json()["detail"]
    assert "minutos" in locked.json()["detail"]


def test_the_limit_counts_the_name_however_it_is_written(client):
    register(client)
    for name in ["Ana Beltrán", "ana beltrán", " ANA  BELTRÁN ", "ana beltrán", "Ana Beltrán"]:
        assert sign_in(client, usuario=name, clave="000000").status_code == 401

    assert sign_in(client, usuario="ANA BELTRÁN").status_code == 429


def test_the_limit_is_per_account_not_global(client):
    register(client)
    register(client, usuario="Luz Marina", clave="135790")
    for _ in range(6):
        sign_in(client, clave="000000")

    other = sign_in(client, usuario="Luz Marina", clave="135790")

    assert other.status_code == 200


def test_the_lock_ends_when_the_window_passes(client, db):
    register(client)
    for _ in range(6):
        sign_in(client, clave="000000")
    assert sign_in(client).status_code == 429

    # Pretend the 15 minutes went by.
    db.intentos_ingreso.update_many({}, {"$set": {"desde": utcnow() - timedelta(minutes=16)}})

    assert sign_in(client).status_code == 200


def test_a_successful_sign_in_resets_the_failed_attempts(client):
    register(client)
    for _ in range(4):
        sign_in(client, clave="000000")
    assert sign_in(client).status_code == 200

    for _ in range(4):  # four more failures are fine: the counter started again
        assert sign_in(client, clave="000000").status_code == 401
    assert sign_in(client).status_code == 200


def test_attempts_for_unknown_users_are_limited_too(client):
    for _ in range(5):
        sign_in(client, usuario="nadie", clave="111111")

    assert sign_in(client, usuario="nadie", clave="111111").status_code == 429


def test_a_deactivated_account_cannot_sign_in(client, db):
    register(client)
    db.usuarios.update_one({"usuario": "ana beltrán"}, {"$set": {"activo": False}})

    assert sign_in(client).status_code == 401


# ---- the session -----------------------------------------------------------


def test_who_am_i_needs_a_session(client):
    assert client.get("/api/auth/yo").status_code == 401


def test_who_am_i_returns_the_profile(client, narrator):
    body = client.get("/api/auth/yo", headers=narrator["headers"]).json()

    assert body == {"id": narrator["usuario"]["id"], "nombre": "Ana Beltrán", "rol": "narrador"}


def test_a_tampered_token_is_refused(client, narrator):
    token = narrator["token"]
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")

    assert client.get("/api/auth/yo", headers=bearer(tampered)).status_code == 401
    assert client.get("/api/auth/yo", headers=bearer("not-a-token")).status_code == 401


def test_a_token_signed_with_another_secret_is_refused(client, narrator):
    forged = jwt.encode(
        {"sub": narrator["usuario"]["id"], "rol": "administrador", "exp": utcnow() + timedelta(hours=1)},
        "another-secret-that-is-also-long-enough-123",
        algorithm="HS256",
    )

    assert client.get("/api/auth/yo", headers=bearer(forged)).status_code == 401


def test_an_expired_token_is_refused(client, db, settings, narrator):
    from lib.core.security import create_token

    user = db.usuarios.find_one({"usuario": "ana beltrán"})
    old = create_token(user, settings, now=utcnow() - timedelta(days=31))

    response = client.get("/api/auth/yo", headers=bearer(old))

    assert response.status_code == 401
    assert "venció" in response.json()["detail"]


def test_a_token_of_a_deleted_or_deactivated_user_is_refused(client, db, narrator):
    db.usuarios.update_one({"usuario": "ana beltrán"}, {"$set": {"activo": False}})

    assert client.get("/api/auth/yo", headers=narrator["headers"]).status_code == 401


def test_narrator_sessions_last_30_days_and_administrator_sessions_8_hours(client, narrator, admin, settings):
    def lifetime(token):
        claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return timedelta(seconds=claims["exp"] - claims["iat"])

    assert lifetime(narrator["token"]) == timedelta(days=30)
    assert lifetime(admin["token"]) == timedelta(hours=8)


# ---- server configuration --------------------------------------------------


def test_without_jwt_secret_the_server_says_so_instead_of_failing(app, settings):
    from dataclasses import replace

    from fastapi.testclient import TestClient

    from lib.core.settings import get_settings

    app.dependency_overrides[get_settings] = lambda: replace(settings, jwt_secret=None)
    response = TestClient(app).post("/api/auth/registro", json=NARRATOR)

    assert response.status_code == 503
    assert "JWT_SECRET" in response.json()["detail"]


def test_a_short_jwt_secret_is_not_accepted(app, settings):
    from dataclasses import replace

    from fastapi.testclient import TestClient

    from lib.core.settings import get_settings

    app.dependency_overrides[get_settings] = lambda: replace(settings, jwt_secret="too-short")
    response = TestClient(app).post(LOGIN, json={"usuario": "Ana Beltrán", "clave": "482193"})

    assert response.status_code == 503
