from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.ai import chat_alias_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.metrics import render_metrics
from app.core.rate_limit import client_ip, init_redis, limiter  # noqa: F401
from app.db import create_db_and_tables, engine, get_session
from sqlalchemy import text as sa_text
from app.error_handlers import register_error_handlers
from app.frontend_serving import mount_frontend
from app.middlewares import (
    cache_control_middleware,
    request_id_version_and_access_log,
    security_headers_middleware,
)
from app.services.seed import ensure_default_drills, ensure_dev_seed_data

os.environ.setdefault("TZ", settings.tz)

setup_logging()
logger = logging.getLogger("app")


# ------------------------------------------------------------------
#  Lifespan
# ------------------------------------------------------------------


@asynccontextmanager
async def lifespan(_: FastAPI):
    _init_sentry()
    init_redis()
    if settings.auto_create_db:
        create_db_and_tables()
        with get_session() as s:
            if settings.seed_dev_data and settings.env in ("dev", "test"):
                ensure_dev_seed_data(s)
            else:
                ensure_default_drills(s)
    yield


# ------------------------------------------------------------------
#  App
# ------------------------------------------------------------------

app = FastAPI(title=settings.app_name, version=settings.api_version, lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=600)

# Register middleware
app.middleware("http")(security_headers_middleware)
app.middleware("http")(cache_control_middleware)
app.middleware("http")(request_id_version_and_access_log)

# Register error handlers
register_error_handlers(app)


# ------------------------------------------------------------------
#  Sentry
# ------------------------------------------------------------------


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


# ------------------------------------------------------------------
#  CORS
# ------------------------------------------------------------------

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


# ------------------------------------------------------------------
#  Routes
# ------------------------------------------------------------------


@app.get("/api/v1/health")
def health():
    checks: dict[str, str] = {}

    # DB check
    try:
        with engine.connect() as conn:
            conn.execute(sa_text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc.__class__.__name__}"

    # Redis check (optional)
    try:
        from app.core.rate_limit import get_redis_client
        import asyncio

        redis = get_redis_client()
        if redis is not None:
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(redis.ping())
                checks["redis"] = "ok"
            except Exception:
                checks["redis"] = "error"
            finally:
                loop.close()
        else:
            checks["redis"] = "not_configured"
    except Exception:
        checks["redis"] = "not_configured"

    all_ok = all(v == "ok" or v == "not_configured" for v in checks.values())
    status_code = 200 if all_ok else 503
    from starlette.responses import JSONResponse

    return JSONResponse({"ok": all_ok, "checks": checks}, status_code=status_code)


@app.get("/metrics")
def metrics(request: Request):
    if not settings.metrics_enabled:
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

# Mount frontend SPA (must be after API routes)
mount_frontend(app)
