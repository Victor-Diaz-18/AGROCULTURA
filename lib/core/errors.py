"""Domain errors raised by services and turned into JSON responses by the API.

Messages are user-facing and written in Spanish. `code` is a stable,
machine-readable identifier the frontend can rely on.
"""

from __future__ import annotations


class DomainError(Exception):
    status_code = 400
    code = "error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class UnauthorizedError(DomainError):
    status_code = 401
    code = "no_autenticado"


class ForbiddenError(DomainError):
    status_code = 403
    code = "sin_permiso"


class NotFoundError(DomainError):
    status_code = 404
    code = "no_encontrado"


class ConflictError(DomainError):
    status_code = 409
    code = "conflicto"


class InvalidDataError(DomainError):
    status_code = 422
    code = "datos_invalidos"


class DatabaseUnavailableError(DomainError):
    status_code = 503
    code = "base_de_datos_no_disponible"


class TooManyRequestsError(DomainError):
    status_code = 429
    code = "demasiados_intentos"


class ConfigurationError(DomainError):
    """The server is missing a setting it needs (for example JWT_SECRET)."""

    status_code = 503
    code = "configuracion_incompleta"


class PayloadTooLargeError(DomainError):
    status_code = 413
    code = "archivo_muy_grande"


class StorageUnavailableError(DomainError):
    """The file store (Vercel Blob) is not configured or did not answer."""

    status_code = 503
    code = "almacen_no_disponible"


class VoiceUnavailableError(DomainError):
    """The voice of the portal is not set up or its service failed: the app reads with the voice of the device."""

    status_code = 503
    code = "voz_no_disponible"
