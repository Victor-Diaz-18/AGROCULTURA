import pymongo
import pytest

from lib.seed.catalog import seed_catalog
from tests.factories import make_story


def test_seed_fills_an_empty_database(db):
    for name in ("sectores", "etiquetas", "configuracion"):
        db[name].delete_many({})

    inserted = seed_catalog(db)

    assert inserted == {"sectores": 4, "etiquetas": 6, "configuracion": 1}


def test_seed_never_overwrites_existing_data(db):
    db.etiquetas.delete_one({"nombre": "#oficios"})  # an admin removed a tag
    db.configuracion.update_one({"_id": "portal"}, {"$set": {"nombre_portal": "Nombre nuevo"}})

    inserted = seed_catalog(db)

    assert inserted == {"sectores": 0, "etiquetas": 0, "configuracion": 0}
    assert db.etiquetas.count_documents({"nombre": "#oficios"}) == 0
    assert db.configuracion.find_one({"_id": "portal"})["nombre_portal"] == "Nombre nuevo"


def test_story_codes_are_unique(db):
    db.historias.insert_one(make_story(codigo="HIS-2026-001"))

    with pytest.raises(pymongo.errors.DuplicateKeyError):
        db.historias.insert_one(make_story(codigo="HIS-2026-001"))
