"""The voice of the portal: what may be read, and that it is made only once."""

from __future__ import annotations

import pytest

from lib.core.settings import Settings, get_settings
from lib.stories import consent
from lib.voice import azure, service
from tests.factories import make_story


@pytest.fixture
def voice(app, monkeypatch):
    """The service set up, with Azure replaced: remembers every text it was asked to read."""
    said: list[str] = []
    settings = Settings(env="test", mongodb_uri=None, mongodb_db="x_test", azure_speech_key="clave", azure_speech_region="eastus")
    app.dependency_overrides[get_settings] = lambda: settings

    def synthesize(_settings, text):
        said.append(text)
        return b"mp3"

    monkeypatch.setattr(azure, "synthesize", synthesize)
    return said


def publish(db, **overrides):
    story = make_story(**{"codigo": "HIS-2026-050", "estado": "publicada", **overrides})
    db.historias.insert_one(story)
    return story


def test_config_says_whether_the_voice_is_set_up(client, voice):
    assert client.get("/api/config").json()["voz_disponible"] is True


def test_without_the_key_there_is_no_voice_and_azure_is_not_called(client):
    assert client.get("/api/config").json()["voz_disponible"] is False
    response = client.get("/api/voz/fincas")
    assert response.status_code == 503
    assert response.json()["code"] == "voz_no_disponible"


def test_reads_the_first_farms_with_the_words_of_the_page(client, voice):
    response = client.get("/api/voz/fincas")

    assert response.status_code == 200
    assert response.json()["url"]
    assert "La Victoria, 1896." in voice[0]
    assert "5775 metros" in voice[0]


def test_makes_the_audio_only_once(client, voice):
    first = client.get("/api/voz/fincas").json()["url"]
    second = client.get("/api/voz/fincas").json()["url"]

    assert first == second
    assert len(voice) == 1


def test_the_opening_says_nothing_of_what_waits_for_review(client, voice, db):
    db.historias.insert_one(make_story(codigo="HIS-2026-051", estado="revision", titulo="Secreta"))

    assert client.get("/api/voz/portada").status_code == 200
    assert "revisión" not in voice[0]
    assert "Secreta" not in voice[0]


def test_reads_a_published_story(client, voice, db):
    publish(db, titulo="El camino viejo", texto="El café bajaba en mula.")

    assert client.get("/api/voz/historias/HIS-2026-050").status_code == 200
    assert "El camino viejo." in voice[0]
    assert "El café bajaba en mula." in voice[0]


@pytest.mark.parametrize("estado", ["revision", "rechazada", "borrador"])
def test_a_story_that_is_not_published_never_reaches_the_service(client, voice, db, estado):
    publish(db, estado=estado)

    assert client.get("/api/voz/historias/HIS-2026-050").status_code == 404
    assert voice == []


def test_the_real_name_of_an_anonymous_story_never_reaches_the_service(client, voice, db):
    publish(db, anonima=True, narrador_nombre="Nombre Real Privado", texto="Una historia.")

    assert client.get("/api/voz/historias/HIS-2026-050").status_code == 200
    assert "Nombre Real Privado" not in voice[0]
    assert "Narrador anónimo" in voice[0]


def test_the_hidden_place_of_a_story_never_reaches_the_service(client, voice, db):
    publish(db, ubicacion_modo="ninguna", lugar_nombre="Finca secreta de mis abuelos", texto="Una historia.")

    assert client.get("/api/voz/historias/HIS-2026-050").status_code == 200
    assert "Finca secreta" not in voice[0]


def test_stops_at_the_limit_of_the_day_and_says_so(client, app, voice):
    settings = Settings(env="test", mongodb_uri=None, mongodb_db="x_test", azure_speech_key="c", azure_speech_region="r", voz_max_caracteres_dia=10)
    app.dependency_overrides[get_settings] = lambda: settings

    assert client.get("/api/voz/fincas").status_code == 429
    assert voice == []


def test_what_is_written_goes_escaped_to_azure(monkeypatch):
    sent = {}

    class Answer:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self):
            return b"mp3"

    def urlopen(request, timeout):
        sent["body"] = request.data.decode()
        sent["url"] = request.full_url
        return Answer()

    monkeypatch.setattr(azure.urllib.request, "urlopen", urlopen)
    settings = Settings(env="test", mongodb_uri=None, mongodb_db="x_test", azure_speech_key="c", azure_speech_region="eastus")

    assert azure.synthesize(settings, "Café <b> & más") == b"mp3"
    assert "es-CO-GonzaloNeural" in sent["body"]
    assert "Café &lt;b&gt; &amp; más" in sent["body"]
    assert sent["url"].startswith("https://eastus.tts.speech.microsoft.com/")


@pytest.mark.parametrize("page", ["mis-historias", "contar-1", "contar-2", "revision", "historias-propias", "configuracion", "proximamente-360", "proximamente-ra"])
def test_reads_the_fixed_words_of_each_page(client, voice, page):
    assert client.get(f"/api/voz/paginas/{page}").status_code == 200
    assert len(voice) == 1


def test_the_last_step_of_telling_reads_the_authorization_the_person_is_shown(client, voice):
    assert client.get("/api/voz/paginas/contar-3-ninguna_sin_nombre").status_code == 200
    words = consent.public_texts()["narrador"]["ninguna_sin_nombre"]["texto"]
    assert service.for_speech(words) in voice[0]
    assert "{texto}" not in voice[0]


@pytest.mark.parametrize("page", ["no-existe", "contar-3", "contar-3-inventada", "..%2Fsecreto"])
def test_a_page_that_is_not_on_the_list_is_never_read(client, voice, page):
    assert client.get(f"/api/voz/paginas/{page}").status_code == 404
    assert voice == []


def test_the_map_says_the_public_counters_and_no_story(client, voice, db):
    db.historias.insert_one(make_story(codigo="HIS-2026-052", estado="revision", titulo="Sin revisar", texto="Texto privado"))

    assert client.get("/api/voz/mapa").status_code == 200
    assert "1 historia esperando revisión" in voice[0]
    assert "Sin revisar" not in voice[0]
    assert "Texto privado" not in voice[0]


def test_each_voice_keeps_its_own_audio(client, app, voice):
    client.get("/api/voz/fincas")
    other = Settings(env="test", mongodb_uri=None, mongodb_db="x_test", azure_speech_key="c", azure_speech_region="r", azure_speech_voice="es-CO-SalomeNeural")
    app.dependency_overrides[get_settings] = lambda: other

    client.get("/api/voz/fincas")

    assert len(voice) == 2  # not the audio of the other voice


def test_writes_numbers_and_units_for_a_voice():
    assert service.for_speech("5.775 m, a unos 14 km · 100.000 «#café»") == "5775 metros, a unos 14 kilómetros, 100000 café"
