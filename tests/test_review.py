"""Reviewing stories (F6): approve with the three checks, reject with a reason, and only once."""

from datetime import datetime

import pytest

from tests.factories import make_story

ALL_CHECKS = ["tema", "territorio", "datos"]


def waiting(db, code="HIS-2026-020", **overrides):
    values = {
        "codigo": code,
        "estado": "revision",
        "origen": "comunidad",
        "publicada_en": None,
        "enviada_en": datetime(2026, 10, 18, 12),
        "creada_en": datetime(2026, 10, 18, 12),
        **overrides,
    }
    db.historias.insert_one(make_story(**values))
    return code


def approve(client, admin, code, checks=ALL_CHECKS):
    return client.post(f"/api/admin/historias/{code}/aprobar", headers=admin["headers"], json={"confirmaciones": checks})


def reject(client, admin, code, motivo="fuera-del-tema"):
    return client.post(f"/api/admin/historias/{code}/rechazar", headers=admin["headers"], json={"motivo": motivo})


def stats(client):
    return client.get("/api/estadisticas").json()


# ---- the queue -----------------------------------------------------------------


def test_the_queue_shows_what_waits_for_review_oldest_first_with_all_its_content(client, db, admin):
    waiting(db, "HIS-2026-021", titulo="Segunda", enviada_en=datetime(2026, 10, 20), creada_en=datetime(2026, 10, 20))
    waiting(
        db,
        "HIS-2026-020",
        titulo="Primera",
        texto="El texto completo.",
        medios=[{"tipo": "audio", "url": "https://x.public.blob.vercel-storage.com/historias/u/a.webm", "duracion_s": 40}],
    )
    db.historias.insert_one(make_story(codigo="HIS-2026-001"))  # published: not in the queue

    queue = client.get("/api/admin/historias?estado=revision", headers=admin["headers"]).json()

    assert [story["titulo"] for story in queue] == ["Primera", "Segunda"]
    first = queue[0]
    assert first["texto"] == "El texto completo."
    assert first["formatos"] == ["Audio"]
    assert first["medios"][0]["url"].endswith("/a.webm")
    assert first["narrador_nombre"] and first["estado"] == "revision" and first["origen"] == "comunidad"


def test_the_administrators_get_the_point_of_each_story(client, db, admin):
    waiting(db, ubicacion={"type": "Point", "coordinates": [-74.1, 11.12]})

    story = client.get("/api/admin/historias?estado=revision", headers=admin["headers"]).json()[0]

    assert (story["lat"], story["lon"]) == (11.12, -74.1)


def test_the_list_can_be_filtered_by_state_and_origin(client, db, admin):
    waiting(db)
    db.historias.insert_one(make_story(codigo="HIS-2026-002", estado="publicada", origen="proyecto"))
    db.historias.insert_one(make_story(codigo="HIS-2026-003", estado="rechazada", motivo_rechazo="x"))

    by_state = client.get("/api/admin/historias?estado=rechazada", headers=admin["headers"]).json()
    by_origin = client.get("/api/admin/historias?origen=proyecto", headers=admin["headers"]).json()

    assert [s["codigo"] for s in by_state] == ["HIS-2026-003"]
    assert [s["codigo"] for s in by_origin] == ["HIS-2026-002"]


def test_a_state_or_origin_that_does_not_exist_is_refused(client, admin):
    assert client.get("/api/admin/historias?estado=borrador-raro", headers=admin["headers"]).status_code == 422
    assert client.get("/api/admin/historias?origen=otro", headers=admin["headers"]).status_code == 422


# ---- approving -----------------------------------------------------------------


def test_approving_publishes_the_story_and_changes_the_counters(client, db, admin):
    code = waiting(db)
    before = stats(client)

    response = approve(client, admin, code)

    assert response.status_code == 200
    assert response.json()["estado"] == "publicada"
    stored = db.historias.find_one({"codigo": code})
    assert stored["estado"] == "publicada"
    assert stored["publicada_en"] is not None
    assert str(stored["revisada_por"]) == admin["usuario"]["id"]
    after = stats(client)
    assert after["publicadas"] == before["publicadas"] + 1
    assert after["en_revision"] == before["en_revision"] - 1
    assert after["aprobadas_comunidad"] == before["aprobadas_comunidad"] + 1


@pytest.mark.parametrize("checks", [[], ["tema"], ["tema", "territorio"], ["tema", "territorio", "otra"], ["datos", "territorio"]])
def test_approving_needs_the_three_checks(client, db, admin, checks):
    code = waiting(db)

    response = approve(client, admin, code, checks)

    assert response.status_code == 422
    assert "tres comprobaciones" in response.json()["detail"]
    assert db.historias.find_one({"codigo": code})["estado"] == "revision"


def test_a_story_is_not_published_before_an_administrator_approves_it(client, db, admin):
    waiting(db)

    assert stats(client)["publicadas"] == 0


# ---- rejecting (case 3) ----------------------------------------------------------


@pytest.mark.parametrize("motivo", ["", "motivo-inventado", "Fuera del tema"])
def test_rejecting_needs_a_reason_from_the_list(client, db, admin, motivo):
    code = waiting(db)

    response = reject(client, admin, code, motivo)

    assert response.status_code == 422
    assert response.json()["detail"] == "Elige el motivo del rechazo."
    assert db.historias.find_one({"codigo": code})["estado"] == "revision"


def test_rejecting_without_sending_a_reason_at_all_is_refused(client, db, admin):
    code = waiting(db)

    response = client.post(f"/api/admin/historias/{code}/rechazar", headers=admin["headers"], json={})

    assert response.status_code == 422
    assert db.historias.find_one({"codigo": code})["estado"] == "revision"


def test_rejecting_keeps_the_reason_and_the_narrator_reads_it(client, db, admin, narrator):
    sent = client.post(
        "/api/historias",
        headers=narrator["headers"],
        json={
            "client_id": "borrador-000001",
            "titulo": "Un viaje a la ciudad",
            "texto": "Fuimos a la ciudad.",
            "epoca": "2000 en adelante",
            "sector_id": "minca",
            "etiquetas": [],
            "ubicacion": {"lat": 11.14, "lon": -74.118},
            "ubicacion_origen": "sector",
            "medios": [],
        },
    ).json()

    response = reject(client, admin, sent["codigo"], "fuera-del-tema")

    assert response.status_code == 200
    assert response.json()["estado"] == "rechazada"
    mine = client.get("/api/historias/mias", headers=narrator["headers"]).json()
    assert mine[0]["estado"] == "rechazada"
    assert mine[0]["motivo_rechazo"] == "Fuera del tema: no trata de la cultura cafetera"
    assert stats(client)["rechazadas"] == 1
    assert stats(client)["publicadas"] == 0


def test_a_rejected_story_never_shows_up_as_published(client, db, admin):
    code = waiting(db)

    reject(client, admin, code)

    assert db.historias.find_one({"codigo": code})["publicada_en"] is None
    assert stats(client)["publicadas"] == 0


# ---- once ------------------------------------------------------------------------


def test_a_story_is_decided_only_once(client, db, admin):
    code = waiting(db)
    assert approve(client, admin, code).status_code == 200

    again = approve(client, admin, code)
    changed_mind = reject(client, admin, code)

    assert again.status_code == 409
    assert changed_mind.status_code == 409
    assert "ya fue revisada" in again.json()["detail"]
    assert db.historias.find_one({"codigo": code})["estado"] == "publicada"


def test_a_rejected_story_cannot_be_approved_afterwards(client, db, admin):
    code = waiting(db)
    reject(client, admin, code)

    response = approve(client, admin, code)

    assert response.status_code == 409
    assert db.historias.find_one({"codigo": code})["estado"] == "rechazada"


def test_an_unknown_code_is_not_found(client, admin):
    assert approve(client, admin, "HIS-2026-999").status_code == 404
    assert reject(client, admin, "HIS-2026-999").status_code == 404


def test_the_teams_own_stories_do_not_go_through_review(client, db, admin):
    db.historias.insert_one(make_story(codigo="HIS-2026-030", origen="proyecto", estado="publicada"))

    response = approve(client, admin, "HIS-2026-030")

    assert response.status_code == 409
    assert "proyecto" in response.json()["detail"]
