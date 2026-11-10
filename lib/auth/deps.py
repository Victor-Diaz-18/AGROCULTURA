"""FastAPI dependencies that protect routes."""

from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.database import Database

from lib.auth import repository
from lib.auth.admins import is_main
from lib.auth.constants import ROL_ADMIN
from lib.core.db import get_db
from lib.core.errors import ForbiddenError, UnauthorizedError
from lib.core.security import decode_token
from lib.core.settings import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """The signed-in user. Role and status come from the database, not from the token."""
    if credentials is None:
        raise UnauthorizedError("Ingresa para continuar.")
    claims = decode_token(credentials.credentials, settings)
    user = repository.find_by_id(db, claims["sub"])
    if user is None or not user.get("activo", True):
        raise UnauthorizedError("Tu sesión no es válida o venció. Ingresa de nuevo.")
    return user


def require_roles(*roles: str):
    """Dependency factory: only the given roles get through (403 for everyone else)."""

    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["rol"] not in roles:
            raise ForbiddenError("No tienes permiso para esta sección.")
        return user

    return dependency


require_admin = require_roles(ROL_ADMIN)


def require_main_admin(user: dict = Depends(require_admin), settings: Settings = Depends(get_settings)) -> dict:
    """Only the administrator named by ADMIN_USER gets through: the ones it creates cannot manage administrators."""
    if not is_main(user, settings):
        raise ForbiddenError("Solo el administrador principal puede gestionar a los administradores.")
    return user
