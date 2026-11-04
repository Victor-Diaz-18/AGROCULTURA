import logging

from pymongo.errors import OperationFailure

from lib.core import indexes


def test_an_index_failure_is_logged_with_its_kind_first_and_does_not_stop_the_api(db, monkeypatch, caplog):
    def not_authorized(_db):
        raise OperationFailure("not authorized on agrocultura to execute command", code=13)

    monkeypatch.setattr(indexes, "ensure_indexes", not_authorized)
    indexes._ready.clear()

    with caplog.at_level(logging.ERROR):
        indexes.ensure_indexes_once(db)  # must not raise

    first_line = caplog.records[0].getMessage()
    assert "OperationFailure" in first_line and "not authorized" in first_line
    assert not indexes._ready  # it will try again on the next request
