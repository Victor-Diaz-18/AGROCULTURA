from tests.factories import make_story


def test_stats_are_zero_on_an_empty_database(client):
    body = client.get("/api/estadisticas").json()

    assert body["publicadas"] == 0
    assert body["en_revision"] == 0
    assert body["sectores_con_historias"] == 0
    assert body["total_sectores"] == 4
    assert body["formatos"] == {"foto": 0, "audio": 0, "video": 0}


def test_stats_count_only_what_is_published_on_the_map(client, db):
    db.historias.insert_many(
        [
            make_story(origen="comunidad", sector_id="minca", medios=[{"tipo": "audio"}, {"tipo": "foto"}]),
            make_story(origen="comunidad", sector_id="minca", medios=[{"tipo": "audio"}]),
            make_story(origen="proyecto", sector_id="tijereras", medios=[{"tipo": "video"}]),
            make_story(estado="revision", sector_id="la-tagua", medios=[{"tipo": "audio"}]),
            make_story(estado="rechazada", sector_id="san-lorenzo"),
        ]
    )

    body = client.get("/api/estadisticas").json()

    assert body["publicadas"] == 3
    assert body["en_revision"] == 1
    assert body["rechazadas"] == 1
    assert body["por_origen"] == {"comunidad": 2, "proyecto": 1}
    assert body["aprobadas_comunidad"] == 2
    assert body["sectores_con_historias"] == 2  # minca and tijereras; the others are not published
    assert body["formatos"] == {"foto": 1, "audio": 2, "video": 1}
