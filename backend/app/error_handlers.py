"""Centralized error/exception handlers for the FastAPI application."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings

logger = logging.getLogger("app")


def _error_payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "details": details or {},
    }


async def validation_error_handler(_: Request, exc: RequestValidationError):
    safe_errors = jsonable_encoder(exc.errors())
    return JSONResponse(
        status_code=422,
        content=_error_payload(
            code="validation_error",
            message="Invalid request",
            details={"errors": safe_errors},
        ),
    )


async def http_error_handler(_: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and {"code", "message", "details"}.issubset(detail.keys()):
        payload = detail
    else:
        payload = _error_payload(
            code="http_error",
            message=str(detail) if detail else "HTTP error",
            details={"status_code": exc.status_code},
        )
    return JSONResponse(status_code=exc.status_code, content=payload, headers=exc.headers)


async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception(
        "unhandled_error",
        extra={"path": request.url.path, "method": request.method},
    )
    details: dict[str, Any] = {"type": exc.__class__.__name__}
    if settings.env in ("dev", "test"):
        details["error"] = repr(exc)
    return JSONResponse(
        status_code=500,
        content=_error_payload(
            code="internal_error",
            message="Internal server error",
            details=details,
        ),
    )


def register_error_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to the given app instance."""
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
