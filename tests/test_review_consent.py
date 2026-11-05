"""The review checks the narrator's consent (once it is demanded), and the sectors are never a boundary in what the team reads."""

from datetime import datetime

import pytest

from lib.stories import consent
from lib.stories.constants import COMPROBACIONES, MOTIVOS_RECHAZO
from tests.factories import make_story, story_payload

THREE = list(COMPROBACIONES)
FOUR = [*THREE, "consentimiento"]
RECORD = {"version": consent.VERSION, "variante": "aproximada_con_nombre", "de": "narrador", "aceptado_en": datetime(2026, 10, 18, 11)}


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


def approve(client, admin, code, checks):
    return client.post(f"/api/admin/historias/{code}/aprobar", headers=admin["headers"], json={"confirmaciones": checks})


def reject(client, admin, code, motivo):
    return client.post(f"/api/admin/historias/{code}/rechazar", headers=admin["headers"], json={"motivo": motivo})


@pytest.fixture
def demanded(monkeypatch):
    monkeypatch.setattr(consent, "EXIGIR_CONSENTIMIENTO", True)


# ---- while it is not demanded, nothing changes --------------------------------------------------------------------


def test_while_the_consent_is_not_demanded_three_checks_are_enough_with_or_without_a_record(client, db, admin):
    with_record = waiting(db, "HIS-2026-021", consentimiento=RECORD)
    without = waiting(db, "HIS-2026-022")

    assert approve(client, admin, with_record, THREE).status_code == 200
    assert approve(client, admin, without, THREE).status_code == 200


# ---- once it is demanded --------------------------------------------------------------------------------------------


def test_the_narrators_consent_is_one_more_check_of_the_review(client, db, admin, demanded):
    code = waiting(db, consentimiento=RECORD)

    refused = approve(client, admin, code, THREE)
    approved = approve(client, admin, code, FOUR)

    assert refused.status_code == 422
    assert "todas las comprobaciones" in refused.json()["detail"]
    assert approved.status_code == 200
    assert approved.json()["estado"] == "publicada"


def test_a_story_sent_before_the_consent_existed_cannot_be_published_even_with_every_check(client, db, admin, demanded):
    code = waiting(db)  # no record of any authorization

    response = approve(client, admin, code, FOUR)

    assert response.status_code == 422
    assert "autorización del narrador" in response.json()["detail"]
    assert "Falta la autorización" in response.json()["detail"]  # says what to do: reject it with that reason
    assert db.historias.find_one({"codigo": code})["estado"] == "revision"


def test_such_a_story_can_be_rejected_with_its_own_reason_and_the_narrator_reads_it(client, db, narrator, admin):
    sent = client.post("/api/historias", headers=narrator["headers"], json=story_payload()).json()  # no consent record

    response = reject(client, admin, sent["codigo"], "falta-autorizacion")

    assert response.status_code == 200
    mine = client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]
    assert mine["estado"] == "rechazada"
    assert mine["motivo_rechazo"] == "Falta la autorización del narrador para publicarla"


def test_the_team_can_still_reject_a_story_without_consent_when_it_is_demanded(client, db, admin, demanded):
    code = waiting(db)

    assert reject(client, admin, code, "falta-autorizacion").status_code == 200


def test_a_story_without_a_place_is_approved_with_the_same_checks(client, db, admin, demanded):
    code = waiting(db, consentimiento={**RECORD, "variante": "ninguna_con_nombre"}, ubicacion_modo="ninguna", ubicacion=None)

    assert approve(client, admin, code, FOUR).status_code == 200


# ---- the sectors are not a boundary ---------------------------------------------------------------------------------


def test_no_reason_nor_check_says_a_story_is_inside_or_outside_a_sector_or_the_territory():
    texts = [reason["texto"] for reason in MOTIVOS_RECHAZO] + [reason["etiqueta"] for reason in MOTIVOS_RECHAZO]

    for text in texts:
        assert "no ocurrió en" not in text
        assert "aledaño" not in text
        assert "Fuera del territorio" not in text


def test_the_reason_about_the_zone_asks_for_a_relation_with_the_coffee_zone(client):
    reasons = {reason["id"]: reason for reason in client.get("/api/config").json()["motivos_rechazo"]}

    assert reasons["fuera-del-territorio"]["texto"] == "Sin relación con la zona cafetera de Minca y sus alrededores"
    assert "falta-autorizacion" in reasons
