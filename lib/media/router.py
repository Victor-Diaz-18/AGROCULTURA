from fastapi import APIRouter, Depends, File, Form, UploadFile

from lib.auth.constants import ROL_ADMIN, ROL_NARRADOR
from lib.auth.deps import require_roles
from lib.core.errors import InvalidDataError
from lib.media import service
from lib.media.schemas import MedioOut
from lib.media.storage import Storage, get_storage
from lib.media.validation import MAX_MEDIA_BYTES

router = APIRouter(tags=["medios"])


@router.post("/medios", response_model=MedioOut, status_code=201)
def upload(
    tipo: str = Form(...),
    archivo: UploadFile = File(...),
    duracion_s: int | None = Form(None),
    user: dict = Depends(require_roles(ROL_NARRADOR, ROL_ADMIN)),
    storage: Storage = Depends(get_storage),
):
    """Uploads one photo or audio (already compressed by the phone) and returns its public URL."""
    if duracion_s is not None and not 0 <= duracion_s <= 3600:
        raise InvalidDataError("La duración del audio no es válida.")
    content = archivo.file.read(MAX_MEDIA_BYTES + 1)  # one byte more than the limit is enough to know it is too big
    return service.save_media(storage, user_id=str(user["_id"]), tipo=tipo, content=content, duracion_s=duracion_s)
