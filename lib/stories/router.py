from fastapi import APIRouter, Depends, Response
from pymongo.database import Database

from lib.auth.constants import ROL_NARRADOR
from lib.auth.deps import require_roles
from lib.core.db import get_db
from lib.stories import service
from lib.stories.schemas import Estadisticas, HistoriaIn, HistoriaMia, HistoriaOut

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
