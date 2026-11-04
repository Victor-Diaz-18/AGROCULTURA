"""File storage. This is the only module that knows about Vercel Blob.

Swapping the provider later means writing another class with `save` and
returning it from `get_storage`; nothing else changes.
"""

from __future__ import annotations

import logging
from typing import Protocol

from lib.core.errors import StorageUnavailableError

logger = logging.getLogger(__name__)


class Storage(Protocol):
    def save(self, pathname: str, content: bytes, content_type: str) -> str:
        """Stores the file and returns its public URL."""


class VercelBlobStorage:
    """Public Vercel Blob store. The SDK reads BLOB_READ_WRITE_TOKEN from the environment."""

    def save(self, pathname: str, content: bytes, content_type: str) -> str:
        # Imported here: the SDK is only needed when a file is uploaded.
        from vercel.blob import sync as blob

        try:
            result = blob.put_blob(
                pathname,
                content,
                access="public",
                content_type=content_type,
                add_random_suffix=True,  # the URL cannot be guessed
            )
        except blob.BlobCredentialsError:
            raise StorageUnavailableError(
                "Falta configurar el almacén de archivos en el servidor (BLOB_READ_WRITE_TOKEN)."
            ) from None
        except Exception as exc:
            logger.error("Could not store a file (%s: %s)", type(exc).__name__, exc, exc_info=True)
            raise StorageUnavailableError("No pudimos guardar el archivo. Intenta de nuevo.") from None
        return result.url


def get_storage() -> Storage:
    """FastAPI dependency; tests replace it with an in-memory fake."""
    return VercelBlobStorage()
