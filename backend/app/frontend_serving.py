"""Frontend static-file serving for same-origin deployment."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings

logger = logging.getLogger("app")


def _is_within(root: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(root.resolve())
        return True
    except Exception:
        return False


def mount_frontend(app: FastAPI) -> None:
    """Conditionally mount the frontend SPA on the given FastAPI app."""
    if not settings.serve_frontend:
        return

    frontend_dist = settings.frontend_dist_dir
    frontend_index = frontend_dist / "index.html"

    if not frontend_index.exists():
        logger.warning(
            "frontend_dist_missing_or_invalid",
            extra={"frontend_dist": str(frontend_dist), "expected_index": str(frontend_index)},
        )
        return

    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    for public_file in ("favicon.ico", "manifest.webmanifest", "robots.txt"):
        candidate = frontend_dist / public_file
        if candidate.exists():

            @app.get(f"/{public_file}", include_in_schema=False)
            def _serve_public_file(file_path: Path = candidate):
                return FileResponse(file_path)

    @app.get("/{frontend_path:path}", include_in_schema=False)
    def _serve_frontend(frontend_path: str):
        blocked_exact = {"api", "docs", "redoc", "openapi.json", "metrics"}
        blocked_prefixes = ("api/", "docs/", "redoc/", "metrics/")
        if frontend_path in blocked_exact or frontend_path.startswith(blocked_prefixes):
            raise StarletteHTTPException(status_code=404, detail="Not found")

        relative = frontend_path.strip("/")
        requested = (
            (frontend_dist / relative).resolve() if relative else frontend_index.resolve()
        )
        if requested.exists() and requested.is_file() and _is_within(frontend_dist, requested):
            return FileResponse(requested)
        return FileResponse(frontend_index)

    logger.info(
        "frontend_serving_enabled",
        extra={"frontend_dist": str(frontend_dist), "index": str(frontend_index)},
    )
