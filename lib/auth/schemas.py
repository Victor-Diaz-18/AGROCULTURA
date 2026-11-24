"""Request and response models for sign-up and sign-in. Messages are shown to people, in Spanish."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from lib.auth.constants import MIN_ADMIN_PASSWORD_LENGTH
from lib.auth.phone import normalize_phone
from lib.auth.username import MAX_USERNAME_LENGTH, MIN_PASSWORD_LENGTH, MIN_USERNAME_LENGTH, clean_username
from lib.core.security import MAX_SECRET_BYTES


def check_narrator_password(value: str) -> str:
    """A narrator's password: anything with at least 6 characters. Not trimmed: whatever the person types is the password."""
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.")
    if len(value.encode("utf-8")) > MAX_SECRET_BYTES:
        raise ValueError("La contraseña es demasiado larga. Acórtala un poco.")
    return value


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
        return check_narrator_password(value)


class IngresoIn(BaseModel):
    """Everybody signs in the same way. A `rol` sent by an older version of the app is ignored: the account says what it is."""

    usuario: str = Field(min_length=1, max_length=80)
    clave: str = Field(min_length=1, max_length=72)


class UsuarioOut(BaseModel):
    id: str
    nombre: str
    rol: str
    principal: bool = False  # the main administrator: the only one who manages administrators


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


class NarradorOut(BaseModel):
    """A narrator account as the team sees it, to find a family's account. Never the password, not even its hash."""

    id: str
    nombre: str
    usuario: str  # what they sign in with: the user name, or the mobile number of the accounts made with a PIN
    historias: int  # how many stories they sent: helps tell apart two accounts with similar names
    creado_en: datetime | None = None
    ultimo_ingreso: datetime | None = None
    clave_restablecida_por: str | None = None  # user name of the administrator who last gave them a new password
    clave_restablecida_en: datetime | None = None


class ClaveNuevaIn(BaseModel):
    """The new password an administrator gives a narrator who forgot theirs: the same rule as when the account is made."""

    clave: str = Field(max_length=200)

    @field_validator("clave")
    @classmethod
    def check_password(cls, value: str) -> str:
        return check_narrator_password(value)
