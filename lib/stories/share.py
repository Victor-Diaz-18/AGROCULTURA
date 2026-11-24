"""The link of a story to share: /h/<código>.

WhatsApp, Facebook and the other apps read the title, the text and the image of a link from the page itself, without
running JavaScript. The portal is a single page that only says "AGROCULTURA" until its JavaScript runs, so this page is
written by the server, with the story's title, who tells it, a bit of its text and its first photo (or the cover photo when
it has none). A person who opens the link is sent at once to the story on the map.

It shows what the public card shows and nothing else (see privacy.py): only published stories, "Narrador anónimo" for an
anonymous one, and no place for a story published without one.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
from html import escape
from urllib.parse import quote

from pymongo.database import Database

from lib.catalog import service as catalog
from lib.config import repository as config
from lib.stories import repository
from lib.stories.service import story_public

COVER = "/compartir.jpg"  # in public/: the cover photo of the portal, 1200 × 630 as the apps want it
DESCRIPTION_LENGTH = 160
_HOST = re.compile(r"^[A-Za-z0-9.-]+(:\d+)?$")


def site_url(headers, scheme: str) -> str:
    """https://agrocultura.vercel.app, or whatever address the link was opened at (a preview, the computer of a developer)."""
    host = headers.get("x-forwarded-host") or headers.get("host") or ""
    if not _HOST.match(host):
        host = "agrocultura.vercel.app"
    proto = headers.get("x-forwarded-proto") or scheme
    return f"{'http' if proto == 'http' else 'https'}://{host}"


def _shorten(text: str, length: int) -> str:
    text = " ".join(text.split())
    if len(text) <= length:
        return text
    cut = text[: length - 1].rsplit(" ", 1)[0]
    return cut.rstrip(",.;:") + "…"


def story_preview(db: Database, code: str) -> dict | None:
    """What the apps show of a published story, or None when there is none to show."""
    story = repository.find_published(db, code)
    if story is None:
        return None
    card = story_public(story)
    sector = catalog.get_sector(db, card["sector_id"]) if card["sector_id"] else None
    place = card["lugar_nombre"] or (sector["nombre"] if sector else None)
    who = f"Contada por {card['narrador_nombre']}" if card["narrador_nombre"] else None
    summary = " · ".join(part for part in (who, place, card["epoca"]) if part)
    text = _shorten(card["texto"], DESCRIPTION_LENGTH) if card["texto"] else ""
    return {
        "codigo": card["codigo"],
        "titulo": card["titulo"],
        "descripcion": f"{summary}. {text}" if text else summary,
        "imagen": card["foto_url"],  # None: the cover photo
    }


def render(db: Database, code: str, base: str) -> tuple[int, str]:
    """(status, page, security policy) for /h/<code>: the story's preview, or the portal's when the story is not published."""
    portal = config.get_portal(db)["nombre_portal"]
    preview = story_preview(db, code)
    if preview is None:
        status, go_to = 404, "/"
        page = _page(
            title=portal,
            description="Memoria histórica y patrimonio cultural de la cultura cafetera de Minca y sectores aledaños.",
            image=base + COVER,
            url=base + "/",
            go_to=go_to,
            site=portal,
        )
    else:
        code_in_url = quote(preview["codigo"], safe="")
        status, go_to = 200, f"/?historia={code_in_url}&ficha=1"  # the story on the map, with its card open
        page = _page(
            title=preview["titulo"],
            description=preview["descripcion"],
            image=preview["imagen"] or base + COVER,
            url=f"{base}/h/{code_in_url}",
            go_to=go_to,
            site=portal,
        )
    return status, page, content_policy(go_to)


def _redirect_script(go_to: str) -> str:
    target = json.dumps(go_to).replace("<", "\\u003c")  # a JavaScript string that cannot close the <script>
    return f"location.replace({target})"


def content_policy(go_to: str) -> str:
    """The page loads nothing and runs only its own line of script (by its hash): the strictest policy there is.

    vercel.json leaves /h/ out of the portal's policy, which allows no inline script at all.
    """
    digest = base64.b64encode(hashlib.sha256(_redirect_script(go_to).encode("utf-8")).digest()).decode("ascii")
    return f"default-src 'none'; script-src 'sha256-{digest}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"


def _page(*, title: str, description: str, image: str, url: str, go_to: str, site: str) -> str:
    e = lambda value: escape(value, quote=True)  # noqa: E731 - everything that goes in the page, in every place
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} · {e(site)}</title>
<meta name="description" content="{e(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="{e(site)}">
<meta property="og:locale" content="es_CO">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{e(image)}">
<meta property="og:url" content="{e(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1F3A2E">
<script>{_redirect_script(go_to)}</script>
</head>
<body>
<p><a href="{e(go_to)}">Abrir «{e(title)}» en {e(site)}</a></p>
</body>
</html>
"""
