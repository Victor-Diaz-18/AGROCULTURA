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
