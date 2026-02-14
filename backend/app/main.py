from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.ai import chat_alias_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.csrf import validate_csrf
from app.core.logging import setup_logging
from app.core.metrics import MetricsTimer, record_request, render_metrics
from app.core.rate_limit import client_ip, init_redis, limiter  # noqa: F401
from app.core.request_context import set_request_id
from app.db import create_db_and_tables, get_session
from app.services.seed import ensure_default_drills, ensure_dev_seed_data

os.environ.setdefault("TZ", settings.tz)

setup_logging()
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    _init_sentry()
    init_redis()
    # In dev/tests, optionally auto-create tables (prefer Alembic in prod).
    if settings.auto_create_db:
        create_db_and_tables()
        # Ensure built-in drills exist for reviews.
        with get_session() as s:
            if settings.seed_dev_data and settings.env in ("dev", "test"):
                ensure_dev_seed_data(s)
            else:
                ensure_default_drills(s)
    yield


app = FastAPI(title=settings.app_name, version=settings.api_version, lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=600)


def _add_security_headers(resp: Response, *, is_https: bool) -> None:
    """Apply a conservative set of security headers.

    CSP uses a conservative default and can be adjusted via settings.content_security_policy.
    """
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


@app.middleware("http")
async def _security_headers_middleware(request: Request, call_next):
    response: Response = await call_next(request)
    _add_security_headers(response, is_https=request.url.scheme == "https")
    return response


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
        # Keep SPA HTML revalidatable to avoid stale shell after deploy.
        response.headers.setdefault("Cache-Control", "no-cache")


@app.middleware("http")
async def _cache_control_middleware(request: Request, call_next):
    response: Response = await call_next(request)
    _apply_cache_control(request, response)
    return response


def _init_sentry() -> None:
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.env,
            integrations=[FastApiIntegration()],
            traces_sample_rate=float(settings.sentry_traces_sample_rate or 0.0),
        )
    except Exception:
        logger.exception("sentry_init_failed")


def _error_payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "details": details or {},
    }


@app.exception_handler(RequestValidationError)
async def _validation_error_handler(_: Request, exc: RequestValidationError):
    safe_errors = jsonable_encoder(exc.errors())
    return JSONResponse(
        status_code=422,
        content=_error_payload(
            code="validation_error",
            message="Invalid request",
            details={"errors": safe_errors},
        ),
    )


@app.exception_handler(StarletteHTTPException)
async def _http_error_handler(_: Request, exc: StarletteHTTPException):
    # If handlers raised a standard envelope already, pass it through.
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


@app.exception_handler(Exception)
async def _unhandled_error_handler(request: Request, exc: Exception):
    logger.exception(
        "unhandled_error",
        extra={"path": request.url.path, "method": request.method},
    )
    details: dict[str, Any] = {"type": exc.__class__.__name__}
    if settings.env != "prod":
        details["error"] = repr(exc)
    return JSONResponse(
        status_code=500,
        content=_error_payload(
            code="internal_error",
            message="Internal server error",
            details=details,
        ),
    )


@app.middleware("http")
async def request_id_version_and_access_log(request: Request, call_next):
    rid = request.headers.get("x-request-id") or str(uuid4())
    set_request_id(rid)
    timer = MetricsTimer()
    response = None
    status_code = 500
    try:
        # CSRF protection for cookie-auth requests.
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
                # Metrics must never break the request.
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


_origins = settings.cors_origins_list

if _origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "X-Request-ID",
            settings.csrf_header_name,
        ],
    )
else:
    logger.warning("cors_disabled_no_origins")


@app.get("/api/v1/health")
def health():
    return {"ok": True}


@app.get("/metrics")
def metrics(request: Request):
    if not settings.metrics_enabled:
        # Keep it simple; avoid leaking the endpoint when disabled.
        raise StarletteHTTPException(status_code=404, detail="Not found")
    allowed_ips = set(settings.metrics_allowed_ips_list)
    if allowed_ips:
        ip = client_ip(request)
        if ip not in allowed_ips:
            raise StarletteHTTPException(status_code=404, detail="Not found")

    token = settings.metrics_token.strip()
    if token:
        auth_header = request.headers.get("authorization", "")
        direct_token = request.headers.get("x-metrics-token", "")
        if auth_header != f"Bearer {token}" and direct_token != token:
            raise StarletteHTTPException(status_code=404, detail="Not found")
    data, content_type = render_metrics()
    return Response(content=data, media_type=content_type)


app.include_router(api_router)
app.include_router(chat_alias_router)


def _is_within(root: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(root.resolve())
        return True
    except Exception:
        return False


if settings.serve_frontend:
    frontend_dist = settings.frontend_dist_dir
    frontend_index = frontend_dist / "index.html"

    if frontend_index.exists():
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
    else:
        logger.warning(
            "frontend_dist_missing_or_invalid",
            extra={"frontend_dist": str(frontend_dist), "expected_index": str(frontend_index)},
        )
