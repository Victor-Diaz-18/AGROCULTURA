from fastapi import APIRouter, Depends, Query, Response
from pymongo.database import Database

from lib.auth.constants import ROL_NARRADOR
from lib.auth.deps import require_roles
from lib.core.db import get_db
from lib.stories import service
from lib.stories.schemas import Estadisticas, HistoriaIn, HistoriaMapa, HistoriaMia, HistoriaOut, HistoriaPublica

router = APIRouter(tags=["historias"])


@router.get("/estadisticas", response_model=Estadisticas)
def stats(db: Database = Depends(get_db)):
    """Public counters: published stories, stories waiting for review, formats."""
    return service.get_stats(db)


# Declared before any "/historias/{codigo}" route so "mias" is not taken for a code.
@router.get("/historias/mias", response_model=list[HistoriaMia])
def my_stories(user: dict = Depends(require_roles(ROL_NARRADOR)), db: Database = Depends(get_db)):
    """The narrator's own stories, with their state and, if rejected, the reason."""
    return service.my_stories(db, user)


@router.post("/historias", response_model=HistoriaOut, status_code=201)
def create_story(
    body: HistoriaIn,
    response: Response,
    user: dict = Depends(require_roles(ROL_NARRADOR)),
    db: Database = Depends(get_db),
):
    """Sends a story for review. It never appears on the map until an administrator approves it.

    Sending the same `client_id` twice (for example a draft retried after a bad connection)
    answers 200 with the story already created instead of creating a copy.
    """
    story, created = service.create_story(db, user=user, data=body)
    if not created:
        response.status_code = 200
    return service.story_out(story)


@router.get("/historias", response_model=list[HistoriaMapa])
def published_stories(limite: int = Query(1000, ge=1, le=1000), db: Database = Depends(get_db)):
    """Everything the map shows: the published stories, newest first (public)."""
    return service.list_published(db, limite)


# After "/historias/mias", so "mias" is not taken for a code.
@router.get("/historias/{codigo}", response_model=HistoriaPublica)
def published_story(codigo: str, db: Database = Depends(get_db)):
    """The card of a published story (public). A story that is not published answers 404."""
    return service.get_published(db, codigo)
