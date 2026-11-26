"""Carga en el sitio publicado las historias documentadas de scripts/historias_documentadas.json.

Se corre desde una Terminal, en la carpeta del proyecto:

    python3 scripts/cargar_historias.py

Pide el usuario y la contraseña de un administrador (la contraseña no se ve al escribirla y no se guarda en ninguna parte).
Baja cada foto de Wikimedia Commons y cada audio de Xeno-canto, los sube al sitio y crea la historia del proyecto con sus
fuentes y créditos. Una historia que ya está (mismo título) no se vuelve a cargar, así que se puede correr otra vez sin
duplicar nada.

    python3 scripts/cargar_historias.py --probar     solo revisa que todo se pueda bajar, sin entrar al sitio
    python3 scripts/cargar_historias.py --sitio URL  otro sitio (por defecto https://agrocultura.vercel.app)

Usa solo Python (3.9 o más nuevo), sin instalar nada.
"""

from __future__ import annotations

import argparse
import getpass
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(__file__).with_name("historias_documentadas.json")
CONSENT = ROOT / "lib" / "stories" / "consentimiento.json"
DEFAULT_SITE = "https://agrocultura.vercel.app"
AGENT = "mapa-historias-prototipo/1.0"  # a generic name for the sites the files come from
MAX_BYTES = 3_500_000  # the most the site takes per file (lib/media/validation.py)


def fetch(url: str, *, data: bytes | None = None, headers: dict | None = None, method: str | None = None) -> bytes:
    request = urllib.request.Request(url, data=data, headers={"User-Agent": AGENT, **(headers or {})}, method=method)
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def problem_of(error: urllib.error.HTTPError) -> str:
    try:
        return json.loads(error.read().decode("utf-8")).get("detail", str(error))
    except Exception:  # noqa: BLE001
        return str(error)


# ---- the files -------------------------------------------------------------------------------


def commons_file(name: str) -> tuple[bytes, str, str]:
    """A photo of Wikimedia Commons, 1280 px wide. Returns (content, mime, file name)."""
    query = urllib.parse.urlencode(
        {"action": "query", "titles": f"File:{name}", "prop": "imageinfo", "iiprop": "url|mime", "iiurlwidth": "1280", "format": "json"}
    )
    pages = json.loads(fetch(f"https://commons.wikimedia.org/w/api.php?{query}"))["query"]["pages"]
    info = next(iter(pages.values()))["imageinfo"][0]
    content = fetch(info.get("thumburl") or info["url"])
    return content, "image/jpeg", "foto.jpg"


def xenocanto_file(number: str) -> tuple[bytes, str, str]:
    """A recording of Xeno-canto. One heavier than the site takes is made lighter (AAC) with afconvert, on a Mac."""
    content = fetch(f"https://xeno-canto.org/{number}/download")
    if len(content) <= MAX_BYTES:
        return content, "audio/mpeg", f"xc{number}.mp3"
    if not shutil.which("afconvert"):
        raise RuntimeError(f"la grabación XC{number} pesa más de 3,5 MB y en este computador no está afconvert para aligerarla")
    with tempfile.TemporaryDirectory() as folder:
        source, target = Path(folder, "in.mp3"), Path(folder, "out.m4a")
        source.write_bytes(content)
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "128000", str(source), str(target)], check=True)
        return target.read_bytes(), "audio/mp4", f"xc{number}.m4a"


def download(medio: dict) -> tuple[bytes, str, str]:
    if "commons" in medio:
        return commons_file(medio["commons"])
    if "xenocanto" in medio:
        return xenocanto_file(medio["xenocanto"])
    raise ValueError(f"no sé de dónde bajar este archivo: {medio}")


# ---- the site --------------------------------------------------------------------------------


class Site:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.token = ""

    def call(self, path: str, *, body: dict | None = None, method: str | None = None):
        headers = {"Content-Type": "application/json"} if body is not None else {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        return json.loads(fetch(f"{self.base}/api{path}", data=data, headers=headers, method=method) or b"null")

    def sign_in(self, user: str, password: str) -> dict:
        session = self.call("/auth/ingreso", body={"usuario": user, "clave": password})
        self.token = session["token"]
        return session["usuario"]

    def upload(self, tipo: str, content: bytes, mime: str, name: str, seconds: int | None) -> dict:
        boundary = uuid.uuid4().hex
        parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n{tipo}\r\n'.encode()]
        if seconds is not None:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="duracion_s"\r\n\r\n{seconds}\r\n'.encode())
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="archivo"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
            + content
            + b"\r\n"
        )
        parts.append(f"--{boundary}--\r\n".encode())
        headers = {"Content-Type": f"multipart/form-data; boundary={boundary}", "Authorization": f"Bearer {self.token}"}
        return json.loads(fetch(f"{self.base}/api/medios", data=b"".join(parts), headers=headers))


# ---- one story -------------------------------------------------------------------------------


def media_of(story: dict, site: Site | None) -> list[dict]:
    """Downloads (and, with a site, uploads) the files of a story. Each one keeps its caption with its credit."""
    medios = []
    for medio in story["medios"]:
        if medio["tipo"] == "youtube":  # it stays on YouTube
            medios.append({"tipo": "youtube", "url": medio["url"], "leyenda": medio["leyenda"]})
            continue
        content, mime, name = download(medio)
        size = f"{len(content) / 1_000_000:.1f} MB"
        if site is None:
            print(f"     ✓ {medio['tipo']} {name} ({size})")
            continue
        uploaded = site.upload(medio["tipo"], content, mime, name, medio.get("duracion_s"))
        print(f"     ✓ {medio['tipo']} subido ({size})")
        medios.append({**{key: uploaded.get(key) for key in ("tipo", "url", "mime", "bytes", "duracion_s") if uploaded.get(key) is not None}, "leyenda": medio["leyenda"]})
    return medios


def payload_of(story: dict, medios: list[dict], tags: set[str], consent_version: str) -> dict:
    modo = story.get("ubicacion_modo", "aproximada")
    payload = {
        "client_id": story["client_id"],
        "titulo": story["titulo"],
        "texto": story["texto"],
        "anio_desde": story["anio_desde"],
        "anio_hasta": story["anio_hasta"],
        "etiquetas": [tag for tag in story["etiquetas"] if tag in tags],
        "ubicacion_modo": modo,
        "consentimiento": {"aceptado": True, "version": consent_version},  # the team has the sources and their licenses
        "medios": medios,
    }
    if modo == "aproximada":
        payload["sector_id"] = story["sector_id"]  # the story goes to the center of its sector
    if story.get("lugar_nombre"):
        payload["lugar_nombre"] = story["lugar_nombre"]
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Carga las historias documentadas en el sitio.")
    parser.add_argument("--sitio", default=DEFAULT_SITE)
    parser.add_argument("--probar", action="store_true", help="solo baja los archivos, sin entrar al sitio")
    args = parser.parse_args()
    stories = json.loads(DATA.read_text(encoding="utf-8"))["historias"]
    consent_version = json.loads(CONSENT.read_text(encoding="utf-8"))["version"]

    if args.probar:
        for story in stories:
            print(f"  · {story['titulo']}")
            media_of(story, None)
        print("Todo se pudo bajar.")
        return 0

    site = Site(args.sitio)
    print(f"Sitio: {site.base}")
    config = site.call("/config")
    if "la-tigrera" not in {sector["id"] for sector in config["sectores"]}:
        print("El sitio todavía no tiene la última versión (no aparece el sector La Tigrera). Espera a que Vercel la publique y vuelve a intentar.")
        return 1
    tags = set(config["etiquetas"])

    user = input("Usuario de administrador: ").strip()
    password = getpass.getpass("Contraseña (no se ve al escribirla): ")
    try:
        who = site.sign_in(user, password)
    except urllib.error.HTTPError as error:
        print(f"No se pudo entrar: {problem_of(error)}")
        return 1
    if who.get("rol") != "administrador":
        print("Ese usuario no es administrador.")
        return 1

    existing = {story["titulo"] for story in site.call("/admin/historias?origen=proyecto&limite=200")}
    loaded, skipped, failed = [], [], []
    for story in stories:
        print(f"\n· {story['titulo']}")
        if story["titulo"] in existing:
            print("     ya estaba: no se carga de nuevo")
            skipped.append(story["titulo"])
            continue
        try:
            medios = media_of(story, site)
            created = site.call("/admin/historias-proyecto", body=payload_of(story, medios, tags, consent_version))
        except urllib.error.HTTPError as error:
            print(f"     ✗ el sitio no la aceptó: {problem_of(error)}")
            failed.append(story["titulo"])
            continue
        except Exception as error:  # noqa: BLE001
            print(f"     ✗ no se pudo: {error}")
            failed.append(story["titulo"])
            continue
        print(f"     ✓ publicada como {created['codigo']}")
        loaded.append(story["titulo"])

    print(f"\nListo: {len(loaded)} publicadas, {len(skipped)} ya estaban, {len(failed)} con problemas.")
    for title in failed:
        print(f"  ✗ {title}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
