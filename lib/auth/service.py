"""Sign-up, sign-in and the users the app creates by itself (administrator, demo narrator)."""

from __future__ import annotations

import logging
import math
import re
from datetime import datetime, timedelta

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from lib.auth import repository
from lib.auth.constants import ROL_ADMIN, ROL_NARRADOR
from lib.auth.phone import normalize_phone
from lib.core import security
from lib.core.clock import utcnow
from lib.core.errors import ConflictError, TooManyRequestsError, UnauthorizedError
from lib.core.settings import Settings

logger = logging.getLogger(__name__)

MIN_ADMIN_PASSWORD_LENGTH = 10
_BAD_CREDENTIALS = {
    ROL_NARRADOR: "Celular o clave incorrectos.",
    ROL_ADMIN: "Usuario o contraseña incorrectos.",
}


def public_user(user: dict) -> dict:
    return {"id": str(user["_id"]), "nombre": user["nombre"], "rol": user["rol"]}


def session_for(user: dict, settings: Settings) -> dict:
    return {"token": security.create_token(user, settings), "usuario": public_user(user)}


def register_narrator(
    db: Database, settings: Settings, *, nombre: str, celular: str, pin: str, now: datetime | None = None
) -> dict:
    security.require_secret(settings)  # do not create accounts we cannot give a session to
    now = now or utcnow()
    document = {
        "nombre": nombre,
        "usuario": celular,
        "rol": ROL_NARRADOR,
        "clave_hash": security.hash_secret(pin, settings.bcrypt_rounds),
        "activo": True,
        "creado_en": now,
        "ultimo_ingreso": now,
    }
    try:
        return repository.insert_user(db, document)
    except DuplicateKeyError:
        raise ConflictError("Ese celular ya tiene una cuenta. Toca «Ya tengo cuenta» para ingresar.") from None


def _login_name(rol: str, usuario: str) -> str:
    cleaned = usuario.strip().lower()
    if rol == ROL_NARRADOR:
        return normalize_phone(usuario) or cleaned
    return cleaned


def login(
    db: Database, settings: Settings, *, rol: str, usuario: str, clave: str, now: datetime | None = None
) -> dict:
    security.require_secret(settings)
    now = now or utcnow()
    window = timedelta(minutes=settings.login_window_minutes)
    name = _login_name(rol, usuario)
    key = f"{rol}:{name}"

    attempt = repository.register_attempt(db, key, now, window)
    if attempt["intentos"] > settings.login_max_attempts:
        remaining = attempt["desde"] + window - now
        minutes = max(1, math.ceil(remaining.total_seconds() / 60))
        unit = "minuto" if minutes == 1 else "minutos"
        raise TooManyRequestsError(f"Demasiados intentos. Espera {minutes} {unit} e inténtalo de nuevo.")

    user = repository.find_by_usuario(db, name, rol)
    active = bool(user and user.get("activo", True))
    # Always run one bcrypt comparison, even for unknown users, so the time taken
    # does not reveal whether the account exists.
    hashed = user["clave_hash"] if active else security.dummy_hash(settings.bcrypt_rounds)
    if not (security.verify_secret(clave, hashed) and active):
        raise UnauthorizedError(_BAD_CREDENTIALS[rol])

    repository.clear_attempts(db, key)
    repository.mark_login(db, user["_id"], now)
    return user


def ensure_admin(db: Database, settings: Settings, now: datetime | None = None) -> str:
    """Creates or keeps in sync the administrator defined by ADMIN_USER / ADMIN_PASSWORD.

    The environment is the source of truth for the administrator password: to change
    it, change ADMIN_PASSWORD and redeploy. Returns what happened (for tests and logs).
    """
    if not settings.admin_user or not settings.admin_password:
        return "omitido"
    password = settings.admin_password
    usuario = settings.admin_user.strip().lower()
    if len(password) < MIN_ADMIN_PASSWORD_LENGTH or len(password.encode("utf-8")) > security.MAX_SECRET_BYTES:
        logger.error(
            "ADMIN_PASSWORD must have %d to %d characters; the administrator was not created",
            MIN_ADMIN_PASSWORD_LENGTH,
            security.MAX_SECRET_BYTES,
        )
        return "omitido"
    if normalize_phone(usuario) is not None:
        logger.error("ADMIN_USER looks like a phone number; choose a plain user name")
        return "omitido"

    existing = repository.find_by_usuario(db, usuario)
    if existing is None:
        now = now or utcnow()
        repository.insert_user(
            db,
            {
                "nombre": "Administración",
                "usuario": usuario,
                "rol": ROL_ADMIN,
                "clave_hash": security.hash_secret(password, settings.bcrypt_rounds),
                "activo": True,
                "creado_en": now,
                "ultimo_ingreso": None,
            },
        )
        return "creado"
    if existing["rol"] != ROL_ADMIN:
        logger.error("ADMIN_USER matches an existing account that is not an administrator; left untouched")
        return "omitido"
    if not security.verify_secret(password, existing["clave_hash"]):
        repository.update_secret_hash(db, existing["_id"], security.hash_secret(password, settings.bcrypt_rounds))
        return "actualizado"
    return "sin_cambios"


def ensure_demo_narrator(db: Database, settings: Settings, now: datetime | None = None) -> str:
    """Optional demo narrator from SEED_DEMO_NARRATOR_*. Created once, never modified."""
    if not settings.demo_narrator_phone or not settings.demo_narrator_pin:
        return "omitido"
    phone = normalize_phone(settings.demo_narrator_phone)
    if phone is None or not re.fullmatch(r"\d{4,6}", settings.demo_narrator_pin):
        logger.error("SEED_DEMO_NARRATOR_PHONE / _PIN are not valid; the demo narrator was not created")
        return "omitido"
    if repository.find_by_usuario(db, phone) is not None:
        return "sin_cambios"
    now = now or utcnow()
    repository.insert_user(
        db,
        {
            "nombre": settings.demo_narrator_name,
            "usuario": phone,
            "rol": ROL_NARRADOR,
            "clave_hash": security.hash_secret(settings.demo_narrator_pin, settings.bcrypt_rounds),
            "activo": True,
            "creado_en": now,
            "ultimo_ingreso": None,
        },
    )
    return "creado"


def ensure_initial_users(db: Database, settings: Settings) -> dict[str, str]:
    return {"administrador": ensure_admin(db, settings), "narradora_de_ejemplo": ensure_demo_narrator(db, settings)}
