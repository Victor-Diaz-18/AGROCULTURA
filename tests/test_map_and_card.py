"""The map (F1) and the card of a story (F8): public, published stories only, and nothing private."""

from datetime import datetime

from bson import ObjectId

from tests.factories import make_story

LEAK = ("autor_id", "client_id", "motivo_rechazo", "revisada_por", "estado", "busqueda", "enviada_en", "creada_en", "ejemplo")


def published(db, code, **overrides):
    db.historias.insert_one(make_story(codigo=code, estado="publicada", **overrides))
    return code


def listing(client, **params):
    return client.get("/api/historias", params=params)


# ---- the list the map draws ------------------------------------------------------


def test_the_map_is_public_and_empty_at_first(client):
    response = listing(client)

    assert response.status_code == 200
    assert response.json() == []


def test_it_lists_only_published_stories(client, db):
    published(db, "HIS-2026-001")
    db.historias.insert_one(make_story(codigo="HIS-2026-002", estado="revision"))
    db.historias.insert_one(make_story(codigo="HIS-2026-003", estado="rechazada", motivo_rechazo="x"))
    db.historias.insert_one(make_story(codigo="HIS-2026-004", estado="borrador"))

    codes = [story["codigo"] for story in listing(client).json()]

    assert codes == ["HIS-2026-001"]


def test_a_story_in_review_is_on_the_map_only_after_it_is_approved(client, db, admin):
    db.historias.insert_one(make_story(codigo="HIS-2026-010", estado="revision", origen="comunidad", publicada_en=None))
    assert listing(client).json() == []

    client.post("/api/admin/historias/HIS-2026-010/aprobar", headers=admin["headers"], json={"confirmaciones": ["tema", "territorio", "datos"]})

    assert [story["codigo"] for story in listing(client).json()] == ["HIS-2026-010"]


def test_the_point_comes_as_latitude_and_longitude(client, db):
    published(db, "HIS-2026-001", ubicacion={"type": "Point", "coordinates": [-74.087, 11.13]})

    story = listing(client).json()[0]

    assert (story["lat"], story["lon"]) == (11.13, -74.087)


def test_the_newest_story_comes_first(client, db):
    published(db, "HIS-2026-001", publicada_en=datetime(2026, 9, 1))
    published(db, "HIS-2026-002", publicada_en=datetime(2026, 10, 1))
    published(db, "HIS-2026-003", publicada_en=datetime(2026, 9, 15))

    assert [s["codigo"] for s in listing(client).json()] == ["HIS-2026-002", "HIS-2026-003", "HIS-2026-001"]


def test_it_gives_what_the_list_shows_and_the_first_photo_for_the_thumbnail(client, db):
    photo = "https://s.public.blob.vercel-storage.com/historias/u/a.jpg"
    published(
        db,
        "HIS-2026-001",
        origen="proyecto",
        medios=[{"tipo": "audio", "url": "https://s.public.blob.vercel-storage.com/historias/u/a.webm", "duracion_s": 40}, {"tipo": "foto", "url": photo}, {"tipo": "foto", "url": photo + "2"}],
    )

    story = listing(client).json()[0]

    assert story["foto_url"] == photo
    assert story["formatos"] == ["Audio", "Foto"]
    assert story["origen"] == "proyecto"
    assert story["narrador_nombre"] == "Narrador de prueba"
    assert story["publicada_en"].endswith("Z")


def test_an_example_story_without_files_has_no_thumbnail(client, db):
    published(db, "HIS-2026-001", medios=[{"tipo": "foto"}])

    assert listing(client).json()[0]["foto_url"] is None


def test_the_list_carries_the_tags_for_the_search_box(client, db):
    published(db, "HIS-2026-001", etiquetas=["#café", "#familia"])
    published(db, "HIS-2026-002", etiquetas=[])

    tags = {story["codigo"]: story["etiquetas"] for story in listing(client).json()}

    assert tags == {"HIS-2026-001": ["#café", "#familia"], "HIS-2026-002": []}


def test_the_list_never_carries_the_text_or_anything_private(client, db):
    published(db, "HIS-2026-001", autor_id=ObjectId(), client_id="borrador-123456")

    story = listing(client).json()[0]

    assert "texto" not in story
    for key in LEAK:
        assert key not in story


def test_the_number_of_stories_can_be_limited(client, db):
    for n in range(1, 6):
        published(db, f"HIS-2026-00{n}")

    assert len(listing(client, limite=3).json()) == 3
    assert listing(client, limite=0).status_code == 422
    assert listing(client, limite=5000).status_code == 422


# ---- the card ----------------------------------------------------------------------


def test_the_card_of_a_published_story_is_public(client, db):
    published(
        db,
        "HIS-2026-001",
        texto="El texto completo.",
        etiquetas=["#café", "#oficios"],
        medios=[{"tipo": "audio", "url": "https://s.public.blob.vercel-storage.com/historias/u/a.webm", "mime": "audio/webm", "bytes": 10, "duracion_s": 204}],
    )

    response = client.get("/api/historias/HIS-2026-001")

    assert response.status_code == 200
    card = response.json()
    assert card["texto"] == "El texto completo."
    assert card["etiquetas"] == ["#café", "#oficios"]
    assert card["medios"] == [{"tipo": "audio", "url": "https://s.public.blob.vercel-storage.com/historias/u/a.webm", "mime": "audio/webm", "duracion_s": 204}]
    assert card["titulo"] and card["lat"] and card["lon"]


def test_the_card_never_carries_what_is_private(client, db):
    published(db, "HIS-2026-001", autor_id=ObjectId(), client_id="borrador-123456", motivo_rechazo=None)

    card = client.get("/api/historias/HIS-2026-001").json()

    for key in LEAK:
        assert key not in card
    assert "bytes" not in card["medios"][0] if card["medios"] else True


def test_a_story_that_is_not_published_has_no_card(client, db):
    for code, state in (("HIS-2026-002", "revision"), ("HIS-2026-003", "rechazada"), ("HIS-2026-004", "borrador")):
        db.historias.insert_one(make_story(codigo=code, estado=state))

    for code in ("HIS-2026-002", "HIS-2026-003", "HIS-2026-004", "HIS-2026-999"):
        assert client.get(f"/api/historias/{code}").status_code == 404


def test_mias_is_not_taken_for_a_story_code(client, narrator):
    assert client.get("/api/historias/mias", headers=narrator["headers"]).status_code == 200
    assert client.get("/api/historias/mias").status_code == 401  # the narrators' route, not a missing story
