"""The catalog fills itself the first time the app meets an empty database."""

from lib.core import bootstrap
from lib.core.bootstrap import ensure_initialized
from tests.factories import make_story


def _empty_database(db):
    for name in ("sectores", "etiquetas", "configuracion"):
        db[name].delete_many({})


def test_first_run_fills_the_catalog(db):
    _empty_database(db)

    assert ensure_initialized(db) is True

    assert db.sectores.count_documents({}) == 4
    assert db.etiquetas.count_documents({}) == 6
    assert db.configuracion.find_one({"_id": "portal"})["nombre_portal"] == "AGROCULTURA"
    assert db.configuracion.find_one({"_id": "sistema"})["catalogo_inicializado"] is True


def test_it_happens_only_once_so_removed_tags_do_not_come_back(db):
    _empty_database(db)
    ensure_initialized(db)
    db.etiquetas.delete_many({})  # an administrator removed every tag on purpose

    assert ensure_initialized(db) is False

    assert db.etiquetas.count_documents({}) == 0


def test_a_database_seeded_by_hand_is_adopted_without_duplicates(db):
    # `db` already holds the catalog (as after `python -m scripts.seed`) but has no marker.
    db.configuracion.delete_one({"_id": "sistema"})

    ensure_initialized(db)

    assert db.sectores.count_documents({}) == 4
    assert db.etiquetas.count_documents({}) == 6


def test_it_never_touches_stories(db):
    _empty_database(db)
    db.historias.insert_one(make_story())

    ensure_initialized(db)

    assert db.historias.count_documents({}) == 1


def test_a_concurrent_first_run_is_tolerated(db, monkeypatch):
    from pymongo.errors import DuplicateKeyError

    _empty_database(db)

    def another_instance_won(_db):
        raise DuplicateKeyError("duplicate key")

    monkeypatch.setattr(bootstrap, "seed_catalog", another_instance_won)

    assert ensure_initialized(db) is True
    assert db.configuracion.find_one({"_id": "sistema"})["catalogo_inicializado"] is True


def test_an_initialization_failure_does_not_stop_the_api(db, monkeypatch):
    def broken(_db):
        raise RuntimeError("database unreachable")

    monkeypatch.setattr(bootstrap, "ensure_initialized", broken)
    bootstrap._ready.clear()

    bootstrap.ensure_initialized_once(db)  # must not raise

    assert not bootstrap._ready  # it will try again on the next request
