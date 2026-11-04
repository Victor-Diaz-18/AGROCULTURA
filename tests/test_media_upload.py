"""Photos and audios (F4, F5): what the server accepts and where it keeps it."""

import pytest

from lib.core.errors import StorageUnavailableError
from lib.media.storage import VercelBlobStorage, get_storage
from lib.media.validation import MAX_MEDIA_BYTES
from tests.factories import JPEG, WEBM_AUDIO


def upload(client, headers, tipo, content, name="archivo.bin", **form):
    return client.post("/api/medios", headers=headers, data={"tipo": tipo, **form}, files={"archivo": (name, content, "application/octet-stream")})


def test_a_narrator_uploads_a_photo(client, narrator, storage):
    response = upload(client, narrator["headers"], "foto", JPEG, "mi-finca.jpg")

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "foto" and body["mime"] == "image/jpeg" and body["bytes"] == len(JPEG)
    assert body["duracion_s"] is None
    assert body["url"].startswith("https://store123.public.blob.vercel-storage.com/")
    saved = storage.saved[0]
    assert saved["pathname"].startswith(f"historias/{narrator['usuario']['id']}/")
    assert saved["pathname"].endswith(".jpg")


def test_a_narrator_uploads_a_recording_with_its_duration(client, narrator, storage):
    response = upload(client, narrator["headers"], "audio", WEBM_AUDIO, "grabacion.webm", duracion_s="95")

    assert response.status_code == 201
    assert response.json()["mime"] == "audio/webm"
    assert response.json()["duracion_s"] == 95
    assert storage.saved[0]["pathname"].endswith(".webm")


def test_the_file_name_and_declared_type_do_not_decide_what_it_is(client, narrator):
    # A text file with a ".jpg" name is not a photo.
    response = upload(client, narrator["headers"], "foto", b"<html>not a photo</html>", "foto.jpg")

    assert response.status_code == 422
    assert "no es una foto" in response.json()["detail"]


def test_a_photo_cannot_be_uploaded_as_an_audio_nor_the_other_way_round(client, narrator):
    assert upload(client, narrator["headers"], "audio", JPEG).status_code == 422
    assert upload(client, narrator["headers"], "foto", WEBM_AUDIO).status_code == 422


def test_an_empty_file_is_refused(client, narrator):
    assert upload(client, narrator["headers"], "foto", b"").status_code == 422


def test_a_file_over_the_limit_is_refused_with_a_clear_message(client, narrator, storage):
    too_big = JPEG + b"\x00" * MAX_MEDIA_BYTES

    response = upload(client, narrator["headers"], "foto", too_big)

    assert response.status_code == 413
    assert "muy pesado" in response.json()["detail"]
    assert storage.saved == []


def test_only_photos_and_audios_are_accepted_here(client, narrator):
    assert upload(client, narrator["headers"], "video", WEBM_AUDIO).status_code == 422  # video has its own path


def test_an_invalid_duration_is_refused(client, narrator):
    assert upload(client, narrator["headers"], "audio", WEBM_AUDIO, duracion_s="999999").status_code == 422


def test_uploading_needs_a_session(client):
    assert upload(client, {}, "foto", JPEG).status_code == 401


def test_an_administrator_can_upload_too(client, admin):
    assert upload(client, admin["headers"], "foto", JPEG).status_code == 201


def test_when_the_file_store_fails_the_person_gets_a_clear_message(app, client, narrator):
    class BrokenStorage:
        def save(self, *_args):
            raise StorageUnavailableError("No pudimos guardar el archivo. Intenta de nuevo.")

    app.dependency_overrides[get_storage] = lambda: BrokenStorage()

    response = upload(client, narrator["headers"], "foto", JPEG)

    assert response.status_code == 503
    assert response.json()["detail"] == "No pudimos guardar el archivo. Intenta de nuevo."


def test_without_a_blob_token_the_server_says_what_is_missing(monkeypatch):
    for name in ("BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"):
        monkeypatch.delenv(name, raising=False)

    with pytest.raises(StorageUnavailableError) as problem:
        VercelBlobStorage().save("historias/x/y.jpg", JPEG, "image/jpeg")

    assert "BLOB_READ_WRITE_TOKEN" in problem.value.message
