"""Registration and sign-in (F2): narrators sign up with name + mobile + PIN."""

from datetime import timedelta

import jwt
import pytest

from lib.core.clock import utcnow
from tests.conftest import NARRATOR, bearer, register

LOGIN = "/api/auth/ingreso"


def sign_in(client, celular="3005550192", clave="4821"):
    """Everybody signs in the same way: a user name and a password (a narrator's are the phone and the PIN)."""
    return client.post(LOGIN, json={"usuario": celular, "clave": clave})


# ---- sign up ---------------------------------------------------------------


def test_a_new_narrator_registers_and_is_signed_in_at_once(client):
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["usuario"]["nombre"] == "Ana Beltrán"
    assert body["usuario"]["rol"] == "narrador"
    assert body["token"]
    assert client.get("/api/auth/yo", headers=bearer(body["token"])).json()["nombre"] == "Ana Beltrán"


def test_the_pin_is_stored_hashed_and_never_in_plain_text(client, db):
    register(client, pin="482193")

    stored = db.usuarios.find_one({"usuario": "3005550192"})
    assert stored["clave_hash"].startswith("$2")  # bcrypt
    assert "482193" not in str(stored)


def test_the_same_phone_written_in_different_ways_is_the_same_account(client):
    register(client, celular="300 555 0192")

    again = register(client, nombre="Otra Persona", celular="+57 (300) 555-0192")

    assert again.status_code == 409
    assert "ya tiene una cuenta" in again.json()["detail"]


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"celular": "12345"}, "celular de 10 dígitos"),
        ({"celular": "6015550192"}, "celular de 10 dígitos"),  # a landline, not a mobile
        ({"pin": "123"}, "de 4 a 6 números"),
        ({"pin": "1234567"}, "de 4 a 6 números"),
        ({"pin": "12ab"}, "de 4 a 6 números"),
        ({"nombre": "  "}, "Escribe tu nombre"),
        ({"nombre": "A"}, "Escribe tu nombre"),
    ],
)
def test_invalid_sign_up_data_is_rejected_with_a_message_in_spanish(client, overrides, message):
    response = register(client, **overrides)

    assert response.status_code == 422
    assert message in response.json()["detail"]
    assert response.json()["code"] == "datos_invalidos"


def test_a_validation_error_never_echoes_the_pin_back(client):
    response = register(client, pin="12ab-secret")

    assert "12ab-secret" not in response.text


def test_a_missing_field_gets_a_clear_message(client):
    response = client.post("/api/auth/registro", json={"nombre": "Ana"})

    assert response.status_code == 422
    assert response.json()["detail"] == "Falta completar un dato obligatorio."


# ---- sign in ---------------------------------------------------------------


def test_a_narrator_signs_in_with_the_phone_and_the_pin(client):
    register(client)

    response = sign_in(client, celular="+57 300 555 0192")

    assert response.status_code == 200
    assert response.json()["usuario"]["nombre"] == "Ana Beltrán"


def test_a_wrong_pin_and_an_unknown_phone_get_the_same_answer(client):
    register(client)

    wrong_pin = sign_in(client, clave="0000")
    unknown_phone = sign_in(client, celular="3109998877")

    assert wrong_pin.status_code == unknown_phone.status_code == 401
    assert wrong_pin.json()["detail"] == unknown_phone.json()["detail"] == "Usuario o contraseña incorrectos."


def test_every_failure_says_the_same_whoever_is_signing_in(client, settings, admin):
    register(client)
    answers = [
        sign_in(client, clave="0000"),  # a narrator, wrong PIN
        sign_in(client, celular="3109998877"),  # a phone nobody registered
        sign_in(client, celular=settings.admin_user, clave="no-es-esa-clave"),  # the administrator, wrong password
        sign_in(client, celular="nadie", clave="no-es-esa-clave"),  # a name nobody has
    ]

    assert {answer.status_code for answer in answers} == {401}
    assert {answer.json()["detail"] for answer in answers} == {"Usuario o contraseña incorrectos."}


def test_the_account_says_what_kind_of_person_it_is_so_nobody_has_to(client, settings, admin):
    register(client)

    narrator = sign_in(client)
    administrator = sign_in(client, celular=settings.admin_user, clave=settings.admin_password)

    assert narrator.json()["usuario"]["rol"] == "narrador"
    assert administrator.json()["usuario"]["rol"] == "administrador"


def test_the_user_name_is_not_case_sensitive_but_the_password_is(client, settings, admin):
    ok = sign_in(client, celular=f"  {settings.admin_user.upper()} ", clave=settings.admin_password)
    wrong_case = sign_in(client, celular=settings.admin_user, clave=settings.admin_password.swapcase())

    assert ok.status_code == 200
    assert wrong_case.status_code == 401


def test_a_role_sent_by_an_older_version_of_the_app_is_ignored(client, settings, admin):
    register(client)

    # An old screen asking for the administrator door with a narrator's data: it is still a narrator.
    as_admin = client.post(LOGIN, json={"rol": "administrador", "usuario": "3005550192", "clave": "4821"})
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


def test_five_failed_attempts_lock_the_phone_even_for_the_right_pin(client):
    register(client)
    for _ in range(5):
        assert sign_in(client, clave="0000").status_code == 401

    locked = sign_in(client, clave="4821")  # the right PIN, but too many attempts

    assert locked.status_code == 429
    assert "Demasiados intentos" in locked.json()["detail"]
    assert "minutos" in locked.json()["detail"]


def test_the_limit_is_per_phone_not_global(client):
    register(client)
    register(client, nombre="Luz Marina", celular="3109998877", pin="1357")
    for _ in range(6):
        sign_in(client, clave="0000")

    other = sign_in(client, celular="3109998877", clave="1357")

    assert other.status_code == 200


def test_the_lock_ends_when_the_window_passes(client, db):
    register(client)
    for _ in range(6):
        sign_in(client, clave="0000")
    assert sign_in(client, clave="4821").status_code == 429

    # Pretend the 15 minutes went by.
    db.intentos_ingreso.update_many({}, {"$set": {"desde": utcnow() - timedelta(minutes=16)}})

    assert sign_in(client, clave="4821").status_code == 200


def test_a_successful_sign_in_resets_the_failed_attempts(client):
    register(client)
    for _ in range(4):
        sign_in(client, clave="0000")
    assert sign_in(client, clave="4821").status_code == 200

    for _ in range(4):  # four more failures are fine: the counter started again
        assert sign_in(client, clave="0000").status_code == 401
    assert sign_in(client, clave="4821").status_code == 200


def test_attempts_for_unknown_phones_are_limited_too(client):
    for _ in range(5):
        sign_in(client, celular="3100000000", clave="1111")

    assert sign_in(client, celular="3100000000", clave="1111").status_code == 429


def test_a_deactivated_account_cannot_sign_in(client, db):
    register(client)
    db.usuarios.update_one({"usuario": "3005550192"}, {"$set": {"activo": False}})

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

    user = db.usuarios.find_one({"usuario": "3005550192"})
    old = create_token(user, settings, now=utcnow() - timedelta(days=31))

    response = client.get("/api/auth/yo", headers=bearer(old))

    assert response.status_code == 401
    assert "venció" in response.json()["detail"]


def test_a_token_of_a_deleted_or_deactivated_user_is_refused(client, db, narrator):
    db.usuarios.update_one({"usuario": "3005550192"}, {"$set": {"activo": False}})

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
    response = TestClient(app).post(LOGIN, json={"usuario": "3005550192", "clave": "4821"})

    assert response.status_code == 503
