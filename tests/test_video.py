"""The video of a story (F13): it is uploaded straight to Blob by the phone, so the API only checks what the story says
about it, and lets it be added after the story is sent (a video can take long over a bad connection)."""

import pytest

from lib.media.validation import MAX_VIDEO_BYTES
from tests.conftest import bearer, register
from tests.factories import story_payload

APPROVAL = {"confirmaciones": ["tema", "territorio", "datos", "consentimiento"]}


def video_for(user, name="video-ab12.mp4", **overrides):
    return {
        "tipo": "video",
        "url": f"https://store1.public.blob.vercel-storage.com/historias/{user['usuario']['id']}/{name}",
        "mime": "video/mp4",
        "bytes": 12_000_000,
        **overrides,
    }


def send(client, user, medios=()):
    response = client.post("/api/historias", headers=user["headers"], json=story_payload(medios=list(medios)))
    assert response.status_code == 201, response.text
    return response.json()["codigo"]


def attach(client, user, code, **overrides):
    body = {key: value for key, value in video_for(user, **overrides).items() if key != "tipo"}
    return client.post(f"/api/historias/{code}/video", headers=user["headers"], json=body)


# ---- a story sent with its video ----------------------------------------------------


def test_a_story_can_carry_a_video_and_says_so_in_its_formats(client, db, narrator):
    code = send(client, narrator, [video_for(narrator)])

    stored = db.historias.find_one({"codigo": code})
    assert [medio["tipo"] for medio in stored["medios"]] == ["video"]
    assert client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]["formatos"] == ["Video"]


@pytest.mark.parametrize("mime", ["video/mp4", "video/quicktime", "video/webm"])
def test_the_three_video_types_are_accepted(client, narrator, mime):
    send(client, narrator, [video_for(narrator, mime=mime)])


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"mime": "image/png"}, "MP4, MOV o WebM"),
        ({"mime": "application/x-msdownload"}, "MP4, MOV o WebM"),
        ({"mime": None}, "MP4, MOV o WebM"),
        ({"bytes": MAX_VIDEO_BYTES + 1}, "25 MB"),
        ({"name": "video.exe"}, "no es válido"),
        ({"name": "video.mp3"}, "no es válido"),
    ],
)
def test_a_video_that_is_not_one_is_refused(client, narrator, overrides, message):
    response = client.post("/api/historias", headers=narrator["headers"], json=story_payload(medios=[video_for(narrator, **overrides)]))

    assert response.status_code == 422
    assert message in response.text


def test_a_video_of_exactly_25_mb_is_fine(client, narrator):
    send(client, narrator, [video_for(narrator, bytes=MAX_VIDEO_BYTES)])


def test_a_video_must_be_in_the_narrators_own_folder_of_our_store(client, narrator):
    own = narrator["usuario"]["id"]
    for url in (
        "https://store1.public.blob.vercel-storage.com/historias/otra-persona/v.mp4",
        f"https://evil.example.com/historias/{own}/v.mp4",
        f"http://store1.public.blob.vercel-storage.com/historias/{own}/v.mp4",
    ):
        response = client.post("/api/historias", headers=narrator["headers"], json=story_payload(medios=[video_for(narrator, url=url)]))
        assert response.status_code == 422, url


def test_only_one_video_per_story(client, narrator):
    two = [video_for(narrator, name="a.mp4"), video_for(narrator, name="b.mp4")]

    response = client.post("/api/historias", headers=narrator["headers"], json=story_payload(medios=two))

    assert response.status_code == 422


# ---- the video added after the story ---------------------------------------------------


def test_the_video_can_be_added_after_the_story_was_sent(client, db, narrator):
    code = send(client, narrator)

    response = attach(client, narrator, code)

    assert response.status_code == 200
    assert response.json()["codigo"] == code
    assert response.json()["estado"] == "revision"
    stored = db.historias.find_one({"codigo": code})
    assert [medio["tipo"] for medio in stored["medios"]] == ["video"]
    assert stored["medios"][0]["bytes"] == 12_000_000
    assert client.get("/api/historias/mias", headers=narrator["headers"]).json()[0]["formatos"] == ["Video"]


def test_the_video_keeps_the_audio_and_the_photos_of_the_story(client, db, narrator):
    audio = {"tipo": "audio", "url": f"https://store1.public.blob.vercel-storage.com/historias/{narrator['usuario']['id']}/a.webm", "mime": "audio/webm"}
    code = send(client, narrator, [audio])

    attach(client, narrator, code)

    assert [medio["tipo"] for medio in db.historias.find_one({"codigo": code})["medios"]] == ["audio", "video"]


def test_sending_the_same_video_again_changes_nothing(client, db, narrator):
    code = send(client, narrator)
    attach(client, narrator, code)

    again = attach(client, narrator, code)

    assert again.status_code == 200
    assert len(db.historias.find_one({"codigo": code})["medios"]) == 1


def test_a_second_different_video_is_refused(client, db, narrator):
    code = send(client, narrator)
    attach(client, narrator, code, name="first.mp4")

    response = attach(client, narrator, code, name="second.mp4")

    assert response.status_code == 409
    assert "ya tiene un video" in response.json()["detail"]
    assert db.historias.find_one({"codigo": code})["medios"][0]["url"].endswith("first.mp4")


def test_a_story_sent_with_a_video_does_not_take_another(client, narrator):
    code = send(client, narrator, [video_for(narrator, name="first.mp4")])

    assert attach(client, narrator, code, name="second.mp4").status_code == 409


def test_an_invalid_video_is_not_added(client, db, narrator):
    code = send(client, narrator)

    for overrides in ({"mime": "image/png"}, {"bytes": MAX_VIDEO_BYTES + 1}, {"name": "v.exe"}, {"url": "https://evil.example.com/historias/x/v.mp4"}):
        assert attach(client, narrator, code, **overrides).status_code == 422
    assert db.historias.find_one({"codigo": code})["medios"] == []


def test_nobody_adds_a_video_to_another_persons_story(client, db, narrator):
    code = send(client, narrator)
    session = register(client, usuario="Luis Mora", clave="999999").json()
    other = {**session, "headers": bearer(session["token"])}

    response = attach(client, other, code)

    assert response.status_code == 404 # the same answer as for a story that does not exist
    assert db.historias.find_one({"codigo": code})["medios"] == []


def test_a_story_that_does_not_exist_has_no_video_to_add(client, narrator):
    assert attach(client, narrator, "HIS-2026-999").status_code == 404


@pytest.mark.parametrize("state", ["publicada", "rechazada"])
def test_a_story_that_was_already_reviewed_takes_no_video(client, db, narrator, admin, state):
    code = send(client, narrator)
    if state == "publicada":
        client.post(f"/api/admin/historias/{code}/aprobar", headers=admin["headers"], json=APPROVAL)
    else:
        client.post(f"/api/admin/historias/{code}/rechazar", headers=admin["headers"], json={"motivo": "fuera-del-tema"})

    response = attach(client, narrator, code)

    assert response.status_code == 409
    assert "ya fue revisada" in response.json()["detail"]
    assert db.historias.find_one({"codigo": code})["medios"] == []


def test_a_visitor_and_an_administrator_cannot_use_it(client, narrator, admin):
    code = send(client, narrator)
    body = {"url": "https://store1.public.blob.vercel-storage.com/historias/x/v.mp4", "mime": "video/mp4"}

    assert client.post(f"/api/historias/{code}/video", json=body).status_code == 401
    assert client.post(f"/api/historias/{code}/video", headers=admin["headers"], json=body).status_code == 403


def test_the_video_reaches_the_review_and_the_public_card_once_approved(client, narrator, admin):
    code = send(client, narrator)
    attach(client, narrator, code)

    in_review = client.get("/api/admin/historias?estado=revision", headers=admin["headers"]).json()[0]
    assert [medio["tipo"] for medio in in_review["medios"]] == ["video"]

    client.post(f"/api/admin/historias/{code}/aprobar", headers=admin["headers"], json=APPROVAL)
    card = client.get(f"/api/historias/{code}").json()
    assert [(medio["tipo"], medio["mime"]) for medio in card["medios"]] == [("video", "video/mp4")]
    assert client.get("/api/historias").json()[0]["formatos"] == ["Video"]
    assert client.get("/api/estadisticas").json()["formatos"]["video"] == 1
