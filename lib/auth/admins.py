"""Administrators created from the panel. The one from ADMIN_USER / ADMIN_PASSWORD is the main one and always stays."""

from __future__ import annotations

from datetime import datetime

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from lib.auth import repository
from lib.auth.constants import ROL_ADMIN
from lib.auth.username import username_key
from lib.core import security
from lib.core.clock import utcnow
from lib.core.errors import ConflictError, ForbiddenError, NotFoundError
from lib.core.settings import Settings

_DEACTIVATION_FIELDS = ("desactivado_por", "desactivado_por_usuario", "desactivado_en")


def is_main(user: dict, settings: Settings) -> bool:
    """The main administrator is the one the environment variables name (decided now, so no data to migrate)."""
    return bool(settings.admin_user) and user["usuario"] == username_key(settings.admin_user)


def public_admin(user: dict, settings: Settings) -> dict:
    return {
        "id": str(user["_id"]),
        "nombre": user["nombre"],
        "usuario": user["usuario"],
        "activo": user.get("activo", True),
        "principal": is_main(user, settings),
        "creado_por": user.get("creado_por_usuario"),
        "creado_en": user["creado_en"],
        "desactivado_por": user.get("desactivado_por_usuario"),
        "desactivado_en": user.get("desactivado_en"),
    }


def list_admins(db: Database, settings: Settings) -> list[dict]:
    return [public_admin(user, settings) for user in repository.list_admins(db)]


def create_admin(
    db: Database, settings: Settings, *, creator: dict, usuario: str, nombre: str, clave: str, now: datetime | None = None
) -> dict:
    security.require_secret(settings)
    document = {
        "nombre": nombre,
        "usuario": username_key(usuario),
        "rol": ROL_ADMIN,
        "clave_hash": security.hash_secret(clave, settings.bcrypt_rounds),
        "activo": True,
        "creado_en": now or utcnow(),
        "creado_por": creator["_id"],
        "creado_por_usuario": creator["usuario"],
        "ultimo_ingreso": None,
    }
    try:
        repository.insert_user(db, document)
    except DuplicateKeyError:
        raise ConflictError("Ese nombre de usuario ya está en uso. Elige otro.") from None
    return public_admin(document, settings)


def _target(db: Database, user_id: str) -> dict:
    user = repository.find_by_id(db, user_id)
    if user is None or user["rol"] != ROL_ADMIN:
        raise NotFoundError("No encontramos a ese administrador.")
    return user


def deactivate_admin(
    db: Database, settings: Settings, *, actor: dict, user_id: str, now: datetime | None = None
) -> dict:
    user = _target(db, user_id)
    if is_main(user, settings):
        raise ForbiddenError("El administrador principal no se puede desactivar desde el panel.")
    if user["_id"] == actor["_id"]:
        raise ForbiddenError("No puedes desactivar tu propia cuenta.")
    if not user.get("activo", True):
        raise ConflictError("Ese administrador ya está desactivado.")
    updated = repository.set_active(
        db,
        user["_id"],
        {
            "activo": False,
            "desactivado_por": actor["_id"],
            "desactivado_por_usuario": actor["usuario"],
            "desactivado_en": now or utcnow(),
        },
    )
    return public_admin(updated, settings)


def reactivate_admin(db: Database, settings: Settings, *, user_id: str) -> dict:
    user = _target(db, user_id)
    if user.get("activo", True):
        raise ConflictError("Ese administrador ya está activo.")
    updated = repository.set_active(db, user["_id"], {"activo": True}, unset=_DEACTIVATION_FIELDS)
    return public_admin(updated, settings)
