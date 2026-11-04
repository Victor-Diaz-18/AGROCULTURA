"""Health check used to verify deployments and the database connection."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pymongo.database import Database

from lib import __version__
from lib.core.db import get_db
from lib.core.settings import get_settings

router = APIRouter(tags=["salud"])


@router.get("/salud")
def health(db: Database = Depends(get_db)):
    """Reports API status and whether MongoDB answers a ping."""
    body = {
        "estado": "ok",
        "base_de_datos": "ok",
        "entorno": get_settings().env,
        "version": __version__,
    }
    try:
        db.command("ping")
    except Exception:  # any failure here means the database is not usable
        body["estado"] = "degradado"
        body["base_de_datos"] = "error"
        return JSONResponse(status_code=503, content=body)
    return body
