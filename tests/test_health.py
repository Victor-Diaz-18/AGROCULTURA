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
