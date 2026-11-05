"""A draft sent twice (bad connection, retry) must never create two stories (F10)."""

from pymongo.errors import DuplicateKeyError

from lib.stories import service
from tests.conftest import bearer, register
from tests.factories import story_payload


def send(client, headers, payload):
    return client.post("/api/historias", headers=headers, json=payload)


def test_sending_the_same_draft_twice_returns_the_same_story_without_copying_it(client, db, narrator):
    payload = story_payload()

    first = send(client, narrator["headers"], payload)
    second = send(client, narrator["headers"], payload)

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["codigo"] == first.json()["codigo"]
    assert db.historias.count_documents({}) == 1


def test_a_resend_does_not_use_up_a_story_number(client, narrator):
    payload = story_payload()
    send(client, narrator["headers"], payload)
    send(client, narrator["headers"], payload)

    next_story = send(client, narrator["headers"], story_payload())

    assert next_story.json()["codigo"].endswith("-002")


def test_a_resend_never_changes_a_story_an_administrator_already_decided_on(client, db, narrator):
    payload = story_payload()
    code = send(client, narrator["headers"], payload).json()["codigo"]
    db.historias.update_one({"codigo": code}, {"$set": {"estado": "publicada"}})

    again = send(client, narrator["headers"], {**payload, "titulo": "Otro título distinto"})

    assert again.json()["estado"] == "publicada"
    stored = db.historias.find_one({"codigo": code})
    assert stored["estado"] == "publicada" and stored["titulo"] == payload["titulo"]


def test_two_narrators_can_use_the_same_draft_identifier(client, db, narrator):
    other = register(client, usuario="Luz Marina", clave="135790").json()
    payload = story_payload()

    mine = send(client, narrator["headers"], payload)
    theirs = send(client, bearer(other["token"]), payload)

    assert mine.status_code == theirs.status_code == 201
    assert mine.json()["codigo"] != theirs.json()["codigo"]
    assert db.historias.count_documents({}) == 2


def test_two_sends_of_the_same_draft_arriving_together_end_up_as_one_story(client, db, narrator, monkeypatch):
    payload = story_payload()
    original = send(client, narrator["headers"], payload).json()["codigo"]

    # The second request checks BEFORE the first one is saved (nothing found) and then loses the race.
    real_lookup = service.repository.find_by_client_id
    calls = {"n": 0}

    def lookup(*args, **kwargs):
        calls["n"] += 1
        return None if calls["n"] == 1 else real_lookup(*args, **kwargs)

    def lost_race(_db, _document):
        raise DuplicateKeyError("duplicate key")

    monkeypatch.setattr(service.repository, "find_by_client_id", lookup)
    monkeypatch.setattr(service.repository, "insert", lost_race)

    response = send(client, narrator["headers"], payload)

    assert response.status_code == 200
    assert response.json()["codigo"] == original
    assert db.historias.count_documents({}) == 1
