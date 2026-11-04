"""Route protection: who may enter where. The same dependency will guard every /api/admin route."""

import jwt
import pytest
from fastapi import Depends

from lib.auth.constants import ROL_ADMIN, ROL_NARRADOR
from lib.auth.deps import require_admin, require_roles
from lib.core.clock import utcnow
from tests.conftest import bearer


@pytest.fixture
def guarded(app, client):
    """The real app plus two routes that only exist in tests."""
    app.add_api_route("/api/_prueba/solo-admin", lambda: {"ok": True}, dependencies=[Depends(require_admin)])
    app.add_api_route(
        "/api/_prueba/solo-narrador",
        lambda: {"ok": True},
        dependencies=[Depends(require_roles(ROL_NARRADOR))],
    )
    return client


def test_visitors_are_asked_to_sign_in(guarded):
    response = guarded.get("/api/_prueba/solo-admin")

    assert response.status_code == 401
    assert response.json()["detail"] == "Ingresa para continuar."


def test_a_narrator_is_refused_on_an_administrator_route(guarded, narrator):
    response = guarded.get("/api/_prueba/solo-admin", headers=narrator["headers"])

    assert response.status_code == 403
    assert response.json()["code"] == "sin_permiso"


def test_an_administrator_gets_in(guarded, admin):
    assert guarded.get("/api/_prueba/solo-admin", headers=admin["headers"]).status_code == 200


def test_roles_do_not_mix(guarded, narrator, admin):
    assert guarded.get("/api/_prueba/solo-narrador", headers=narrator["headers"]).status_code == 200
    assert guarded.get("/api/_prueba/solo-narrador", headers=admin["headers"]).status_code == 403


def test_a_forged_administrator_token_is_refused(guarded, narrator):
    forged = jwt.encode(
        {"sub": narrator["usuario"]["id"], "rol": ROL_ADMIN, "exp": utcnow().timestamp() + 3600},
        "a-guess-that-is-not-the-server-secret-1234567",
        algorithm="HS256",
    )

    assert guarded.get("/api/_prueba/solo-admin", headers=bearer(forged)).status_code == 401


def test_the_role_comes_from_the_database_not_from_the_token(guarded, db, admin):
    db.usuarios.update_many({"rol": ROL_ADMIN}, {"$set": {"rol": ROL_NARRADOR}})  # demoted after sign-in

    assert guarded.get("/api/_prueba/solo-admin", headers=admin["headers"]).status_code == 403


def test_a_deactivated_administrator_loses_access_at_once(guarded, db, admin):
    db.usuarios.update_many({"rol": ROL_ADMIN}, {"$set": {"activo": False}})

    assert guarded.get("/api/_prueba/solo-admin", headers=admin["headers"]).status_code == 401


def test_a_wrong_authorization_scheme_is_treated_as_no_session(guarded, admin):
    response = guarded.get("/api/_prueba/solo-admin", headers={"Authorization": f"Basic {admin['token']}"})

    assert response.status_code == 401
