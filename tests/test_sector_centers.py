"""The sector centers can be corrected in the code and reach a database that already has them."""

import pytest

from lib.seed import catalog
from lib.seed.catalog import SECTORES_SEED, sync_sector_centers
from tests.factories import make_story


def point(db, sector_id):
    return db.sectores.find_one({"_id": sector_id})["centro"]["coordinates"]


@pytest.fixture
def corrected(monkeypatch):
    """The code says: one version newer, with La Tagua somewhere else."""
    newer = catalog.SECTORES_VERSION + 1
    seeds = [dict(sector) for sector in SECTORES_SEED]
    for sector in seeds:
        sector["centro_version"] = newer
        if sector["_id"] == "la-tagua":
            sector["centro"] = {"type": "Point", "coordinates": [-74.0, 11.2]}
    monkeypatch.setattr(catalog, "SECTORES_SEED", seeds)
    monkeypatch.setattr(catalog, "SECTORES_VERSION", newer)


def test_a_database_that_is_already_up_to_date_is_left_alone(db):
    before = point(db, "minca")

    assert sync_sector_centers(db) == {}
    assert point(db, "minca") == before


def test_a_corrected_center_reaches_the_database(db, corrected):
    sync_sector_centers(db)

    assert point(db, "la-tagua") == [-74.0, 11.2]
    assert db.sectores.find_one({"_id": "la-tagua"})["centro_version"] == catalog.SECTORES_VERSION
    assert point(db, "minca") == [-74.118, 11.14]  # unchanged sectors keep their point


def test_it_also_serves_sectors_saved_before_versions_existed(db):
    db.sectores.update_many({}, {"$unset": {"centro_version": ""}})

    sync_sector_centers(db)

    assert {s["centro_version"] for s in db.sectores.find()} == {catalog.SECTORES_VERSION}


def test_stories_placed_at_their_sector_move_with_it_keeping_their_small_offsets(db, corrected):
    old_lon, old_lat = point(db, "la-tagua")
    db.historias.insert_one(make_story(codigo="HIS-2026-001", sector_id="la-tagua", ubicacion_origen="sector", ubicacion={"type": "Point", "coordinates": [old_lon, old_lat]}))
    db.historias.insert_one(make_story(codigo="HIS-2026-002", sector_id="la-tagua", ubicacion_origen="sector", ubicacion={"type": "Point", "coordinates": [old_lon + 0.0035, old_lat - 0.00175]}))

    moved = sync_sector_centers(db)

    assert moved["la-tagua"] == 2
    assert moved["minca"] == 0  # its point did not change: nothing to move
    assert db.historias.find_one({"codigo": "HIS-2026-001"})["ubicacion"]["coordinates"] == [-74.0, 11.2]
    assert db.historias.find_one({"codigo": "HIS-2026-002"})["ubicacion"]["coordinates"] == [-73.9965, 11.19825]


def test_stories_with_a_point_of_their_own_never_move(db, corrected):
    gps = {"type": "Point", "coordinates": [-74.09, 11.131]}
    db.historias.insert_one(make_story(codigo="HIS-2026-001", sector_id="la-tagua", ubicacion_origen="gps", ubicacion=gps))
    db.historias.insert_one(make_story(codigo="HIS-2026-002", sector_id="la-tagua", ubicacion_origen="mapa", ubicacion=gps))

    sync_sector_centers(db)

    for code in ("HIS-2026-001", "HIS-2026-002"):
        assert db.historias.find_one({"codigo": code})["ubicacion"] == gps


def test_stories_of_other_sectors_do_not_move(db, corrected):
    minca = {"type": "Point", "coordinates": [-74.118, 11.14]}
    db.historias.insert_one(make_story(codigo="HIS-2026-001", sector_id="minca", ubicacion_origen="sector", ubicacion=minca))

    sync_sector_centers(db)

    assert db.historias.find_one({"codigo": "HIS-2026-001"})["ubicacion"] == minca


def test_running_it_twice_moves_nothing_the_second_time(db, corrected):
    old_lon, old_lat = point(db, "la-tagua")
    db.historias.insert_one(make_story(codigo="HIS-2026-001", sector_id="la-tagua", ubicacion_origen="sector", ubicacion={"type": "Point", "coordinates": [old_lon, old_lat]}))

    first = sync_sector_centers(db)
    second = sync_sector_centers(db)

    assert first["la-tagua"] == 1
    assert second == {}
    assert db.historias.find_one({"codigo": "HIS-2026-001"})["ubicacion"]["coordinates"] == [-74.0, 11.2]


def test_the_app_does_it_by_itself_when_it_starts(db, corrected):
    from lib.core import bootstrap

    bootstrap._centers_ready.clear()
    bootstrap.ensure_initialized_once(db)

    assert point(db, "la-tagua") == [-74.0, 11.2]


# ---- the real correction: from the first provisional positions to the ones given by the team -----------------------


def _as_first_deployed(db):
    """The database as the first deployment left it (version 1, the provisional positions)."""
    old = {"la-tagua": [-74.0868, 11.1301], "san-lorenzo": [-74.154, 11.1245]}
    for sector_id, coordinates in old.items():
        db.sectores.update_one({"_id": sector_id}, {"$set": {"centro": {"type": "Point", "coordinates": coordinates}, "centro_version": 1}})
    db.sectores.update_many({"_id": {"$in": ["minca", "tijereras"]}}, {"$set": {"centro_version": 1}})
    return old


def test_the_real_positions_of_la_tagua_and_san_lorenzo_reach_a_database_left_by_the_first_deployment(db):
    _as_first_deployed(db)

    sync_sector_centers(db)

    assert point(db, "la-tagua") == [-74.044951, 11.082986]
    assert point(db, "san-lorenzo") == [-74.034676, 11.116315]
    assert point(db, "minca") == [-74.118, 11.14]  # it was right already
    assert point(db, "tijereras") == [-74.1108, 11.109]  # still waiting for its real position


def test_the_stories_of_those_sectors_follow_them_and_the_others_stay(db):
    old = _as_first_deployed(db)
    old_lon, old_lat = old["la-tagua"]
    db.historias.insert_many(
        [
            make_story(codigo="HIS-2026-001", sector_id="la-tagua", ubicacion_origen="sector", ubicacion={"type": "Point", "coordinates": [old_lon + 0.0035, old_lat]}),
            make_story(codigo="HIS-2026-002", sector_id="la-tagua", ubicacion_origen="gps", ubicacion={"type": "Point", "coordinates": [-74.09, 11.131]}),
            make_story(codigo="HIS-2026-003", sector_id="tijereras", ubicacion_origen="sector", ubicacion={"type": "Point", "coordinates": [-74.1108, 11.109]}),
        ]
    )

    sync_sector_centers(db)

    moved = db.historias.find_one({"codigo": "HIS-2026-001"})["ubicacion"]["coordinates"]
    assert moved == [round(-74.044951 + 0.0035, 6), 11.082986]
    assert db.historias.find_one({"codigo": "HIS-2026-002"})["ubicacion"]["coordinates"] == [-74.09, 11.131]
    assert db.historias.find_one({"codigo": "HIS-2026-003"})["ubicacion"]["coordinates"] == [-74.1108, 11.109]


def test_only_tijereras_is_marked_as_not_confirmed(client):
    sectors = {s["id"]: s for s in client.get("/api/config").json()["sectores"]}

    assert {sector_id: s["provisional"] for sector_id, s in sectors.items()} == {
        "minca": False,
        "la-tagua": False,
        "san-lorenzo": False,
        "tijereras": True,
    }
