"""Narrator accounts as the team sees them: to find a family's account and give it a new password when they forget it.

There is no password recovery by e-mail or SMS (the families have neither set up here): the family asks the team, any
administrator writes a new password for the account and tells it to them. It becomes their password. The sessions the account
had open (another phone, a lost one) stop working, and the account records who changed it and when.
"""

from __future__ import annotations

from datetime import datetime

from pymongo.database import Database

from lib.auth import repository
from lib.auth.constants import ROL_NARRADOR
from lib.core import security
from lib.core.clock import utcnow
from lib.core.errors import NotFoundError
from lib.core.settings import Settings
from lib.stories import repository as stories


def public_narrator(user: dict, story_count: int) -> dict:
    return {
        "id": str(user["_id"]),
        "nombre": user.get("nombre") or user["usuario"],
        "usuario": user["usuario"],
        "historias": story_count,
        "creado_en": user.get("creado_en"),
        "ultimo_ingreso": user.get("ultimo_ingreso"),
        "clave_restablecida_por": user.get("clave_restablecida_por_usuario"),
        "clave_restablecida_en": user.get("clave_restablecida_en"),
    }


def list_narrators(db: Database) -> list[dict]:
    """Every narrator account, by name, with how many stories each one sent."""
    users = repository.list_narrators(db)
    counts = stories.count_by_author(db, [user["_id"] for user in users])
    users.sort(key=lambda user: (user.get("nombre") or user["usuario"]).casefold())
    return [public_narrator(user, counts.get(user["_id"], 0)) for user in users]


def reset_password(
    db: Database, settings: Settings, *, actor: dict, user_id: str, clave: str, now: datetime | None = None
) -> dict:
    """Gives a narrator the password an administrator wrote, and closes the sessions the account had open."""
    user = repository.find_by_id(db, user_id)
    if user is None or user["rol"] != ROL_NARRADOR:
        raise NotFoundError("No encontramos a ese narrador.")
    now = now or utcnow()
    updated = repository.update_user(
        db,
        user["_id"],
        {
            "clave_hash": security.hash_secret(clave, settings.bcrypt_rounds),
            "clave_cambiada_en": now,  # a session opened before this no longer counts (see deps.get_current_user)
            "clave_restablecida_por": actor["_id"],
            "clave_restablecida_por_usuario": actor["usuario"],
            "clave_restablecida_en": now,
        },
    )
    repository.clear_attempts(db, user["usuario"])  # a family locked out by wrong tries can come in at once
    return public_narrator(updated, stories.count_by_author(db, [user["_id"]]).get(user["_id"], 0))
