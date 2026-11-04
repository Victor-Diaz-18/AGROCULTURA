"""Index checks that only make sense on a real MongoDB (mongomock fakes them)."""

import pytest

pytestmark = pytest.mark.real_mongo


def test_stories_have_a_2dsphere_index_on_location(db):
    index_keys = {name: spec["key"] for name, spec in db.historias.index_information().items()}

    assert index_keys["ubicacion_2dsphere"] == [("ubicacion", "2dsphere")]


def test_a_malformed_location_is_rejected_by_the_geospatial_index(db):
    from pymongo.errors import WriteError

    from tests.factories import make_story

    with pytest.raises(WriteError):
        db.historias.insert_one(make_story(ubicacion={"type": "Point", "coordinates": [500, 500]}))


def test_a_draft_identifier_is_unique_per_author_but_stories_without_one_can_repeat_an_author(db):
    from bson import ObjectId
    from pymongo.errors import DuplicateKeyError

    from tests.factories import make_story

    author = ObjectId()
    db.historias.insert_one(make_story(autor_id=author, client_id="borrador-000001"))

    with pytest.raises(DuplicateKeyError):
        db.historias.insert_one(make_story(autor_id=author, client_id="borrador-000001"))

    # Example/project stories have no client_id: the partial index must not treat "missing" as a repeat.
    db.historias.insert_one(make_story(autor_id=author))
    db.historias.insert_one(make_story(autor_id=author))


def test_the_example_stories_pass_the_geospatial_index_and_a_reset_leaves_no_old_counters(db, settings):
    from lib.seed.demo import build_examples, reset_demo_data

    class NoStorage:
        def delete(self, urls):
            return 0

    db.historias.insert_many(build_examples(db, settings))  # 2dsphere rejects an invalid point

    result = reset_demo_data(db, settings, NoStorage())

    assert result["historias_de_ejemplo"] == 12
    assert db.contadores.find_one({"_id": "historias-2026"})["seq"] == 12
