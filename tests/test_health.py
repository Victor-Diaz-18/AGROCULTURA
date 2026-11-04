from pymongo.errors import OperationFailure

from api.index import create_app
from lib.core.db import get_db
from fastapi.testclient import TestClient


def test_health_reports_ok_when_the_database_answers(client):
    response = client.get("/api/salud")

    assert response.status_code == 200
    body = response.json()
    assert body["estado"] == "ok"
    assert body["base_de_datos"] == "ok"
    assert body["entorno"] == "test"


def test_health_reports_degraded_when_the_database_fails():
    class BrokenDatabase:
        def command(self, *_args, **_kwargs):
            raise RuntimeError("no connection")

    app = create_app()
    app.dependency_overrides[get_db] = lambda: BrokenDatabase()

    response = TestClient(app).get("/api/salud")

    assert response.status_code == 503
    assert response.json()["estado"] == "degradado"


def test_health_names_the_kind_of_error_without_leaking_its_message():
    class RejectedDatabase:
        def command(self, *_args, **_kwargs):
            raise OperationFailure("bad auth: user agrocultura_app secret-detail", code=18)

    app = create_app()
    app.dependency_overrides[get_db] = lambda: RejectedDatabase()

    response = TestClient(app).get("/api/salud")

    body = response.json()
    assert response.status_code == 503
    assert body["causa"] == "OperationFailure"
    assert body["codigo"] == 18
    assert "secret-detail" not in response.text and "agrocultura_app" not in response.text
