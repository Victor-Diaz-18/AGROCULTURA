from fastapi import APIRouter, Depends
from pydantic import BaseModel
from pymongo.database import Database

from lib.core.db import get_db
from lib.core.settings import Settings, get_settings
from lib.media.storage import Storage, get_storage
from lib.voice import service

router = APIRouter(tags=["voz"])


class Audio(BaseModel):
    url: str


@router.get("/voz/portada", response_model=Audio)
def opening(db: Database = Depends(get_db), settings: Settings = Depends(get_settings), storage: Storage = Depends(get_storage)):
    """The opening of the portal, read with the voice of the portal (public)."""
    return {"url": service.voice_of_opening(db, settings, storage)}


@router.get("/voz/fincas", response_model=Audio)
def farms(db: Database = Depends(get_db), settings: Settings = Depends(get_settings), storage: Storage = Depends(get_storage)):
    """The first farms and the facts of the zone, read (public)."""
    return {"url": service.voice_of_farms(db, settings, storage)}


@router.get("/voz/historias/{codigo}", response_model=Audio)
def story(codigo: str, db: Database = Depends(get_db), settings: Settings = Depends(get_settings), storage: Storage = Depends(get_storage)):
    """The card of a published story, read (public). A story that is not published answers 404."""
    return {"url": service.voice_of_story(db, settings, storage, codigo)}
