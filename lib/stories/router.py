from fastapi import APIRouter, Depends
from pymongo.database import Database

from lib.core.db import get_db
from lib.stories import service
from lib.stories.schemas import Estadisticas

router = APIRouter(tags=["historias"])


@router.get("/estadisticas", response_model=Estadisticas)
def stats(db: Database = Depends(get_db)):
    """Public counters: published stories, stories waiting for review, formats."""
    return service.get_stats(db)
