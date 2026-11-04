"""REMOVABLE: "Reiniciar datos de ejemplo". See lib/seed/demo.py for everything that goes with it."""

from fastapi import APIRouter, Depends
from pymongo.database import Database

from lib.admin.schemas import ReinicioIn, ReinicioOut
from lib.auth.deps import require_admin
from lib.core.db import get_db
from lib.core.errors import ForbiddenError, InvalidDataError
from lib.core.settings import Settings, get_settings
from lib.media.storage import Storage, get_storage
from lib.seed import demo

router = APIRouter(prefix="/admin", tags=["administración"], dependencies=[Depends(require_admin)])


@router.post("/reiniciar-ejemplo", response_model=ReinicioOut)
def reset_demo(
    body: ReinicioIn,
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings),
    storage: Storage = Depends(get_storage),
):
    """Deletes ALL stories (the real ones too) and loads the twelve examples. Needs ALLOW_DEMO_RESET."""
    if not settings.allow_demo_reset:
        raise ForbiddenError("El reinicio de datos de ejemplo está desactivado en este servidor.")
    if not body.confirmar:
        raise InvalidDataError("Confirma que entiendes que se borran todas las historias.")
    return demo.reset_demo_data(db, settings, storage)
