from __future__ import annotations

import time
from typing import Any

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

# Keep label set tight to avoid high cardinality.
REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    labelnames=["method", "route", "status_code"],
)

REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    labelnames=["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

WEBHOOK_OUTBOX_ENQUEUED_TOTAL = Counter(
    "webhook_outbox_enqueued_total",
    "Total webhook outbox items enqueued",
    labelnames=["mode", "status"],
)

WEBHOOK_OUTBOX_SENT_TOTAL = Counter(
    "webhook_outbox_sent_total",
    "Total webhook outbox items delivered successfully",
)

WEBHOOK_OUTBOX_RETRY_TOTAL = Counter(
    "webhook_outbox_retry_total",
    "Total webhook outbox retries scheduled",
)

WEBHOOK_OUTBOX_DEAD_TOTAL = Counter(
    "webhook_outbox_dead_total",
    "Total webhook outbox items moved to dead-letter state",
)

WEBHOOK_OUTBOX_QUEUE_DEPTH = Gauge(
    "webhook_outbox_queue_depth",
    "Current webhook outbox queue depth by status",
    labelnames=["status"],
)

# ── AI / Gemini metrics (P2 #24) ──

AI_REQUEST_DURATION_SECONDS = Histogram(
    "ai_request_duration_seconds",
    "Duration of AI/Gemini API calls in seconds",
    labelnames=["endpoint"],
    buckets=(0.1, 0.5, 1, 2, 5, 10, 30, 60),
)

AI_REQUEST_ERRORS_TOTAL = Counter(
    "ai_request_errors_total",
    "Total AI/Gemini API errors",
    labelnames=["endpoint", "error_type"],
)


def route_label(scope: dict[str, Any]) -> str:
    """Return a stable route label (template path) when possible."""
    route = scope.get("route")
    # Starlette / FastAPI route objects usually have `path` (e.g. "/api/v1/sessions/{id}")
    path = getattr(route, "path", None)
    if isinstance(path, str) and path:
        return path
    # Fallback (still bounded-ish for this app).
    return scope.get("path") or "unknown"


class MetricsTimer:
    def __init__(self) -> None:
        self.start = time.perf_counter()

    def duration(self) -> float:
        return max(0.0, time.perf_counter() - self.start)


def record_request(method: str, scope: dict[str, Any], status_code: int, duration_s: float) -> None:
    r = route_label(scope)
    REQUESTS_TOTAL.labels(method=method, route=r, status_code=str(status_code)).inc()
    REQUEST_DURATION_SECONDS.labels(method=method, route=r).observe(duration_s)


def record_webhook_outbox_enqueued(mode: str, status: str, count: int = 1) -> None:
    if count <= 0:
        return
    WEBHOOK_OUTBOX_ENQUEUED_TOTAL.labels(mode=mode, status=status).inc(count)


def record_webhook_outbox_sent(count: int = 1) -> None:
    if count <= 0:
        return
    WEBHOOK_OUTBOX_SENT_TOTAL.inc(count)


def record_webhook_outbox_retry(count: int = 1) -> None:
    if count <= 0:
        return
    WEBHOOK_OUTBOX_RETRY_TOTAL.inc(count)


def record_webhook_outbox_dead(count: int = 1) -> None:
    if count <= 0:
        return
    WEBHOOK_OUTBOX_DEAD_TOTAL.inc(count)


def set_webhook_outbox_depth(depth_by_status: dict[str, int]) -> None:
    for status, count in depth_by_status.items():
        WEBHOOK_OUTBOX_QUEUE_DEPTH.labels(status=status).set(max(0, int(count)))


def record_ai_request(endpoint: str, duration_s: float) -> None:
    """Record a successful AI request duration."""
    AI_REQUEST_DURATION_SECONDS.labels(endpoint=endpoint).observe(duration_s)


def record_ai_error(endpoint: str, error_type: str = "unknown") -> None:
    """Record an AI request error (quota, timeout, invalid, etc)."""
    AI_REQUEST_ERRORS_TOTAL.labels(endpoint=endpoint, error_type=error_type).inc()


def render_metrics() -> tuple[bytes, str]:
    data = generate_latest()
    return data, CONTENT_TYPE_LATEST
