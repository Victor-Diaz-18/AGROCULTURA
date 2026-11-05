from fastapi import APIRouter, Depends
from pymongo.database import Database

from lib.auth import service
from lib.auth.deps import get_current_user
from lib.auth.schemas import IngresoIn, RegistroIn, SesionOut, UsuarioOut
from lib.core.db import get_db
from lib.core.settings import Settings, get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/registro", response_model=SesionOut, status_code=201)
def register(body: RegistroIn, db: Database = Depends(get_db), settings: Settings = Depends(get_settings)):
    """Creates a narrator account (a user name and a password of at least 6 characters) and signs in."""
    user = service.register_narrator(db, settings, usuario=body.usuario, clave=body.clave)
    return service.session_for(user, settings)


@router.post("/ingreso", response_model=SesionOut)
def login(body: IngresoIn, db: Database = Depends(get_db), settings: Settings = Depends(get_settings)):
    """Signs in with a user name and a password (accounts made with a mobile number and a PIN use those)."""
    user = service.login(db, settings, usuario=body.usuario, clave=body.clave)
    return service.session_for(user, settings)


@router.get("/yo", response_model=UsuarioOut)
def me(user: dict = Depends(get_current_user)):
    """The user of the current session."""
    return service.public_user(user)
