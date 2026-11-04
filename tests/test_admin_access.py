"""Case 1: nothing under /api/admin works without an administrator session."""

import pytest

from tests.conftest import bearer, register


def admin_routes(app):
    """(method, path) of every administration route, taken from the API description so a new one is checked too."""
    found = []
    for path, operations in app.openapi()["paths"].items():
        if path.startswith("/api/admin/"):
            found.extend((method.upper(), path) for method in operations if method in ("get", "post", "patch", "put", "delete"))
    return found


def call(client, method, path, headers=None):
    return client.request(method, path.replace("{codigo}", "HIS-2026-001"), headers=headers, json={} if method != "GET" else None)


def test_the_administration_routes_exist(app):
    routes = admin_routes(app)

    assert len(routes) >= 8
    assert ("POST", "/api/admin/historias/{codigo}/aprobar") in routes
    assert ("POST", "/api/admin/reiniciar-ejemplo") in routes


def test_every_administration_route_turns_away_a_visitor(app, client):
    for method, path in admin_routes(app):
        response = call(client, method, path)
        assert response.status_code == 401, f"{method} {path} answered {response.status_code} to a visitor"


def test_every_administration_route_turns_away_a_narrator(app, client, narrator):
    for method, path in admin_routes(app):
        response = call(client, method, path, narrator["headers"])
        assert response.status_code == 403, f"{method} {path} answered {response.status_code} to a narrator"


def test_a_token_that_is_not_ours_is_not_accepted(app, client):
    for method, path in admin_routes(app):
        response = call(client, method, path, bearer("not-a-real-token"))
        assert response.status_code == 401, f"{method} {path} accepted a made-up token"


def test_an_account_that_stopped_being_administrator_loses_access_at_once(client, db, admin):
    db.usuarios.update_one({"rol": "administrador"}, {"$set": {"rol": "narrador"}})

    assert client.get("/api/admin/historias", headers=admin["headers"]).status_code == 403


def test_an_administrator_gets_in(client, admin):
    assert client.get("/api/admin/historias", headers=admin["headers"]).status_code == 200


def test_the_narrator_cannot_reach_review_even_with_a_story_of_their_own(client, narrator, db):
    from tests.factories import make_story

    db.historias.insert_one(make_story(estado="revision", codigo="HIS-2026-050"))

    response = client.post("/api/admin/historias/HIS-2026-050/aprobar", headers=narrator["headers"], json={"confirmaciones": ["tema", "territorio", "datos"]})

    assert response.status_code == 403
    assert db.historias.find_one({"codigo": "HIS-2026-050"})["estado"] == "revision"
