from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from dataset_studio.api import api_router
from dataset_studio.config import Settings
from dataset_studio.db.session import configure_database


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings.default()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        configure_database(config.database_path)
        yield

    app = FastAPI(title="Dataset Studio", version="0.1.0", lifespan=lifespan)
    app.include_router(api_router)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
            },
        )

    static_dir = Path(__file__).parent / "static"
    assets_dir = static_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> Any:
        if path.startswith("api/"):
            return JSONResponse(
                status_code=404, content={"code": "NOT_FOUND", "message": "API route not found"}
            )
        candidate = static_dir / path
        if path and candidate.is_file() and static_dir in candidate.resolve().parents:
            return FileResponse(candidate)
        index = static_dir / "index.html"
        if index.is_file():
            return FileResponse(index)
        return JSONResponse(
            status_code=503,
            content={"code": "FRONTEND_NOT_BUILT", "message": "Run the frontend production build"},
        )

    return app


app = create_app()
