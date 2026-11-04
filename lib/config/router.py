from fastapi import APIRouter, Depends
from pymongo.database import Database

from lib.config import service
from lib.config.schemas import ConfigPublica
from lib.core.db import get_db

router = APIRouter(tags=["config"])


@router.get("/config", response_model=ConfigPublica)
def public_config(db: Database = Depends(get_db)):
    """Portal name, sectors, tags, epochs and rejection reasons (public)."""
    return service.get_public_config(db)
