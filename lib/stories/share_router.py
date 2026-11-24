"""/h/<código>: the link of a story to share (see share.py). It lives outside /api: it is a page, not data."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from pymongo.database import Database

from lib.core.db import get_db
from lib.stories import share

router = APIRouter(tags=["compartir"])


@router.api_route("/h/{codigo}", methods=["GET", "HEAD"], response_class=HTMLResponse, include_in_schema=False)
def share_page(codigo: str, request: Request, db: Database = Depends(get_db)):
    """The preview WhatsApp and the other apps show for a story; a person who opens it goes on to the story on the map."""
    status, page = share.render(db, codigo[:40], share.site_url(request.headers, request.url.scheme))
    # A few minutes, so a story that is deleted stops showing its preview soon after.
    return HTMLResponse(page, status_code=status, headers={"Cache-Control": "public, max-age=300"})
