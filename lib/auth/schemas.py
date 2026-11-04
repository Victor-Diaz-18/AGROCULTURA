"""Request and response models for sign-up and sign-in. Messages are shown to people, in Spanish."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from lib.auth.phone import normalize_phone


class RegistroIn(BaseModel):
    nombre: str = Field(max_length=200)
    celular: str = Field(max_length=40)
    pin: str = Field(max_length=20)

    @field_validator("nombre")
    @classmethod
    def clean_name(cls, value: str) -> str:
        name = re.sub(r"\s+", " ", value).strip()
        if not 2 <= len(name) <= 60:
            raise ValueError("Escribe tu nombre (entre 2 y 60 letras).")
        return name

    @field_validator("celular")
    @classmethod
    def clean_phone(cls, value: str) -> str:
        phone = normalize_phone(value)
        if phone is None:
            raise ValueError("Escribe un número de celular de 10 dígitos, por ejemplo 300 555 0192.")
        return phone

    @field_validator("pin")
    @classmethod
    def check_pin(cls, value: str) -> str:
        if not re.fullmatch(r"\d{4,6}", value):
            raise ValueError("La clave debe tener de 4 a 6 números.")
        return value


class IngresoIn(BaseModel):
    rol: Literal["narrador", "administrador"]
    usuario: str = Field(min_length=1, max_length=80)
    clave: str = Field(min_length=1, max_length=72)


class UsuarioOut(BaseModel):
    id: str
    nombre: str
    rol: str


class SesionOut(BaseModel):
    token: str
    usuario: UsuarioOut
