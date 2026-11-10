"""Request and response models for sign-up and sign-in. Messages are shown to people, in Spanish."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from lib.auth.constants import MIN_ADMIN_PASSWORD_LENGTH
from lib.auth.phone import normalize_phone
from lib.auth.username import MAX_USERNAME_LENGTH, MIN_PASSWORD_LENGTH, MIN_USERNAME_LENGTH, clean_username
from lib.core.security import MAX_SECRET_BYTES


class RegistroIn(BaseModel):
    """A narrator signs up with a user name and a password. The password can be anything with at least 6 characters."""

    usuario: str = Field(max_length=200)
    clave: str = Field(max_length=200)

    @field_validator("usuario")
    @classmethod
    def check_username(cls, value: str) -> str:
        name = clean_username(value)
        if not MIN_USERNAME_LENGTH <= len(name) <= MAX_USERNAME_LENGTH:
            raise ValueError(
                f"Escribe un nombre de usuario (entre {MIN_USERNAME_LENGTH} y {MAX_USERNAME_LENGTH} caracteres)."
            )
        # Stories show this name to everybody: a phone number is not something to publish by accident.
        if normalize_phone(name) is not None:
            raise ValueError("El nombre de usuario no puede incluir un número de celular. Escribe tu nombre o uno que te guste.")
        return name

    @field_validator("clave")
    @classmethod
    def check_password(cls, value: str) -> str:
        # Not trimmed and no other rule: whatever the person types is the password, as long as it is long enough.
        if len(value) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.")
        if len(value.encode("utf-8")) > MAX_SECRET_BYTES:
            raise ValueError("La contraseña es demasiado larga. Acórtala un poco.")
        return value


class IngresoIn(BaseModel):
    """Everybody signs in the same way. A `rol` sent by an older version of the app is ignored: the account says what it is."""

    usuario: str = Field(min_length=1, max_length=80)
    clave: str = Field(min_length=1, max_length=72)


class UsuarioOut(BaseModel):
    id: str
    nombre: str
    rol: str


class SesionOut(BaseModel):
    token: str
    usuario: UsuarioOut


class AdminNuevoIn(BaseModel):
    """An administrator creates another one. The password follows the rule of the main administrator: 10 or more."""

    usuario: str = Field(max_length=200)
    nombre: str = Field(max_length=200)
    clave: str = Field(max_length=200)

    @field_validator("usuario")
    @classmethod
    def check_username(cls, value: str) -> str:
        name = clean_username(value)
        if not MIN_USERNAME_LENGTH <= len(name) <= MAX_USERNAME_LENGTH:
            raise ValueError(
                f"Escribe un nombre de usuario (entre {MIN_USERNAME_LENGTH} y {MAX_USERNAME_LENGTH} caracteres)."
            )
        # Sign-in treats anything that looks like a phone number as a narrator's account.
        if normalize_phone(name) is not None:
            raise ValueError("El nombre de usuario no puede parecer un número de celular.")
        return name

    @field_validator("nombre")
    @classmethod
    def check_name(cls, value: str) -> str:
        name = clean_username(value)
        if not 2 <= len(name) <= MAX_USERNAME_LENGTH:
            raise ValueError(f"Escribe el nombre de quien administra (entre 2 y {MAX_USERNAME_LENGTH} caracteres).")
        return name

    @field_validator("clave")
    @classmethod
    def check_password(cls, value: str) -> str:
        if len(value) < MIN_ADMIN_PASSWORD_LENGTH:
            raise ValueError(f"La contraseña debe tener al menos {MIN_ADMIN_PASSWORD_LENGTH} caracteres.")
        if len(value.encode("utf-8")) > MAX_SECRET_BYTES:
            raise ValueError("La contraseña es demasiado larga. Acórtala un poco.")
        return value


class AdminOut(BaseModel):
    id: str
    nombre: str
    usuario: str
    activo: bool
    principal: bool  # the one from the environment variables: cannot be deactivated from the panel
    creado_por: str | None  # user name of who created it; None for the main administrator
    creado_en: datetime
    desactivado_por: str | None = None
    desactivado_en: datetime | None = None
