"""/h/<código>: the page WhatsApp and the other apps read to show a story's title, text and photo, never more than the card."""

from __future__ import annotations

import re

import pytest

from tests.factories import make_story

PHOTO = "https://store123.public.blob.vercel-storage.com/historias/u/foto.jpg"


def publish(db, **overrides):
    story = make_story(**{"codigo": "HIS-2026-050", "titulo": "El camino de mulas", **overrides})
    db.historias.insert_one(story)
    return story


def meta(page: str, name: str) -> str | None:
    found = re.search(rf'<meta (?:property|name)="{re.escape(name)}" content="([^"]*)">', page)
    return found.group(1) if found else None


def test_a_published_story_shows_its_title_who_tells_it_and_its_photo(client, db):
    publish(db, narrador_nombre="Ana Beltrán", texto="Antes de la carretera el café bajaba en mula.", medios=[{"tipo": "foto", "url": PHOTO}])

    response = client.get("/h/HIS-2026-050")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    page = response.text
    assert meta(page, "og:title") == "El camino de mulas"
    assert meta(page, "og:image") == PHOTO
    assert meta(page, "og:url") == "http://testserver/h/HIS-2026-050"
    assert meta(page, "og:description") == "Contada por Ana Beltrán · Minca · 1960 a 1979. Antes de la carretera el café bajaba en mula."
    assert meta(page, "twitter:card") == "summary_large_image"
    assert "<title>El camino de mulas · AGROCULTURA</title>" in page


def test_whoever_opens_it_goes_on_to_the_story_on_the_map(client, db):
    publish(db)

    page = client.get("/h/HIS-2026-050").text

    assert 'location.replace("/?historia=HIS-2026-050&ficha=1")' in page
    assert 'href="/?historia=HIS-2026-050&amp;ficha=1"' in page  # and a link, in case the page stays


def test_a_story_without_a_photo_shows_the_cover_of_the_portal(client, db):
    publish(db, medios=[{"tipo": "audio", "url": "https://store123.public.blob.vercel-storage.com/a.webm"}])

    assert meta(client.get("/h/HIS-2026-050").text, "og:image") == "http://testserver/compartir.jpg"


def test_it_uses_the_address_the_link_was_opened_at(client, db):
    publish(db)

    page = client.get("/h/HIS-2026-050", headers={"x-forwarded-host": "agrocultura.vercel.app", "x-forwarded-proto": "https"}).text

    assert meta(page, "og:url") == "https://agrocultura.vercel.app/h/HIS-2026-050"
    assert meta(page, "og:image") == "https://agrocultura.vercel.app/compartir.jpg"


def test_a_strange_host_falls_back_to_the_portal_address(client, db):
    publish(db)

    page = client.get("/h/HIS-2026-050", headers={"x-forwarded-host": 'evil.com"><script>'}).text

    assert meta(page, "og:url") == "http://agrocultura.vercel.app/h/HIS-2026-050"
    assert "evil.com" not in page


def test_an_anonymous_story_never_shows_the_name(client, db):
    publish(db, narrador_nombre="Ana Beltrán", anonima=True)

    page = client.get("/h/HIS-2026-050").text

    assert "Ana Beltrán" not in page
    assert meta(page, "og:description").startswith("Contada por Narrador anónimo")


def test_a_story_published_without_a_place_shows_no_place(client, db):
    publish(db, ubicacion_modo="ninguna", lugar_nombre="La casa de la abuela", sector_id="san-lorenzo")

    page = client.get("/h/HIS-2026-050").text

    assert "La casa de la abuela" not in page
    assert "San Lorenzo" not in page
    assert meta(page, "og:description") == "Contada por Narrador de prueba · 1960 a 1979. Texto de la historia."


def test_the_place_name_goes_before_the_sector(client, db):
    publish(db, lugar_nombre="Vereda El Recreo")

    assert "· Vereda El Recreo ·" in meta(client.get("/h/HIS-2026-050").text, "og:description")


def test_a_long_text_is_cut_at_a_word(client, db):
    publish(db, texto="palabra " * 60)

    description = meta(client.get("/h/HIS-2026-050").text, "og:description")

    assert description.endswith("palabra…")
    assert len(description) < 230


def test_whatever_the_story_says_cannot_break_the_page(client, db):
    publish(db, titulo='<script>alert(1)</script> & "comillas"', texto="</script><b>hola</b>")

    page = client.get("/h/HIS-2026-050").text

    assert "<script>alert" not in page
    assert "<b>hola" not in page
    assert meta(page, "og:title") == "&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;comillas&quot;"


@pytest.mark.parametrize("estado", ["revision", "rechazada", "borrador"])
def test_a_story_that_is_not_published_shows_nothing_of_it(client, db, estado):
    publish(db, estado=estado)

    response = client.get("/h/HIS-2026-050")

    assert response.status_code == 404
    assert "El camino de mulas" not in response.text
    assert meta(response.text, "og:title") == "AGROCULTURA"
    assert 'location.replace("/")' in response.text


def test_a_code_that_does_not_exist_shows_the_portal(client, db):
    response = client.get("/h/HIS-2026-999")

    assert response.status_code == 404
    assert meta(response.text, "og:image") == "http://testserver/compartir.jpg"


def test_the_preview_is_kept_only_a_few_minutes_and_answers_a_head_too(client, db):
    publish(db)

    assert client.get("/h/HIS-2026-050").headers["cache-control"] == "public, max-age=300"
    assert client.head("/h/HIS-2026-050").status_code == 200
