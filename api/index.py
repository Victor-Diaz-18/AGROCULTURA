"""Vercel entry point: a single FastAPI app exposed as `app`.

Vercel rewrites `/api/*` to this file (see vercel.json). Locally it also runs
with `uvicorn api.index:app`. Business code lives in `lib/`, not here.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make `lib` importable no matter where the process was started from.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from pymongo.errors import ConnectionFailure  # noqa: E402

from lib import __version__  # noqa: E402
from lib.admin import demo_router, router as admin_router  # noqa: E402
from lib.auth import router as auth_router  # noqa: E402
from lib.config import router as config_router  # noqa: E402
from lib.core import health  # noqa: E402
from lib.core.errors import DomainError  # noqa: E402
from lib.core.settings import get_settings  # noqa: E402
from lib.media import router as media_router  # noqa: E402
from lib.stories import router as stories_router  # noqa: E402
from lib.voice import router as voice_router  # noqa: E402


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="AGROCULTURA API",
        version=__version__,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )

    if settings.cors_origins:  # only needed when the frontend runs on another origin
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.exception_handler(DomainError)
    async def handle_domain_error(_: Request, error: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={"detail": error.message, "code": error.code},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_invalid_request(_: Request, error: RequestValidationError) -> JSONResponse:
        first = error.errors()[0]
        message = str(first.get("msg", ""))
        if message.startswith("Value error, "):
            detail = message.removeprefix("Value error, ")  # a message we wrote, in Spanish
        elif first.get("type") == "missing":
            detail = "Falta completar un dato obligatorio."
        else:
            detail = "Revisa los datos enviados."
        # Only the names of the offending fields: the input itself may be a PIN or a password.
        fields = [str(part) for item in error.errors() for part in item["loc"][1:2]]
        return JSONResponse(
            status_code=422, content={"detail": detail, "code": "datos_invalidos", "campos": fields}
        )

    @app.exception_handler(ConnectionFailure)
    async def handle_connection_failure(_: Request, __: ConnectionFailure) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={
                "detail": "No se pudo conectar con la base de datos. Intenta de nuevo en un momento.",
                "code": "base_de_datos_no_disponible",
            },
        )

    app.include_router(health.router, prefix="/api")
    app.include_router(auth_router.router, prefix="/api")
    app.include_router(config_router.router, prefix="/api")
    app.include_router(media_router.router, prefix="/api")
    app.include_router(stories_router.router, prefix="/api")
    app.include_router(voice_router.router, prefix="/api")
    app.include_router(admin_router.router, prefix="/api")
    app.include_router(demo_router.router, prefix="/api")  # removable: see lib/seed/demo.py
    return app


app = create_app()
