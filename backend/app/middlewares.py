"""Reusable HTTP middleware for the Study Leveling application."""

from __future__ import annotations

import logging
from typing import Any, cast
from uuid import uuid4

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.csrf import validate_csrf
from app.core.metrics import MetricsTimer, record_request
from app.core.request_context import set_request_id

logger = logging.getLogger("app")


# ------------------------------------------------------------------
#  Helpers
# ------------------------------------------------------------------

def _error_payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "details": details or {},
    }


# ------------------------------------------------------------------
#  Security headers
# ------------------------------------------------------------------

def _add_security_headers(resp: Response, *, is_https: bool) -> None:
    """Apply a conservative set of security headers."""
    if not settings.security_headers_enabled:
        return

    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    resp.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    resp.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
    resp.headers.setdefault("Origin-Agent-Cluster", "?1")

    if settings.env not in ("dev", "test") and is_https:
        resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

    if settings.content_security_policy:
        resp.headers.setdefault("Content-Security-Policy", settings.content_security_policy)


async def security_headers_middleware(request: Request, call_next):
    response: Response = await call_next(request)
    _add_security_headers(response, is_https=request.url.scheme == "https")
    return response


# ------------------------------------------------------------------
#  Cache-Control
# ------------------------------------------------------------------

def _apply_cache_control(request: Request, response: Response) -> None:
    if request.method.upper() not in {"GET", "HEAD"}:
        return
    if response.status_code >= 400:
        return

    path = request.url.path
    if path.startswith("/assets/"):
        response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
        return

    if path in {"/favicon.ico", "/manifest.webmanifest", "/robots.txt"}:
        response.headers.setdefault("Cache-Control", "public, max-age=86400")
        return

    if not settings.serve_frontend:
        return
    if path in {"/docs", "/redoc", "/openapi.json", "/metrics"} or path.startswith(
        ("api/", "/api/", "docs/", "/docs/", "redoc/", "/redoc/", "metrics/", "/metrics/")
    ):
        return

    content_type = response.headers.get("content-type", "")
    if "text/html" in content_type:
        response.headers.setdefault("Cache-Control", "no-cache")


async def cache_control_middleware(request: Request, call_next):
    response: Response = await call_next(request)
    _apply_cache_control(request, response)
    return response


# ------------------------------------------------------------------
#  Request-ID, API version & access log
# ------------------------------------------------------------------

async def request_id_version_and_access_log(request: Request, call_next):
    rid = request.headers.get("x-request-id") or str(uuid4())
    set_request_id(rid)
    timer = MetricsTimer()
    response = None
    status_code = 500
    try:
        validate_csrf(request)
        response = await call_next(request)
        status_code = response.status_code
        return response
    except StarletteHTTPException as exc:
        status_code = exc.status_code
        detail = exc.detail
        if isinstance(detail, dict) and {"code", "message", "details"}.issubset(detail.keys()):
            payload = detail
        else:
            payload = _error_payload(
                code="http_error",
                message=str(detail) if detail else "HTTP error",
                details={"status_code": exc.status_code},
            )
        response = JSONResponse(status_code=exc.status_code, content=payload, headers=exc.headers)
        return response
    finally:
        duration_ms = int(timer.duration() * 1000)
        if settings.metrics_enabled:
            try:
                scope = cast(dict[str, Any], dict(request.scope))
                record_request(request.method.upper(), scope, status_code, timer.duration())
            except Exception:
                pass
        if response is not None:
            response.headers["X-Request-ID"] = rid
            response.headers["X-API-Version"] = settings.api_version
        logger.info(
            "request",
            extra={
                "path": request.url.path,
                "method": request.method,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "ip": request.client.host if request.client else None,
            },
        )
        set_request_id(None)
