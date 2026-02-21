"""AI-specific rate limiting for guest, user daily, and user burst windows."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Any

from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.metrics import record_ai_rate_limited
from app.core.rate_limit import client_ip, get_redis_client
from app.models import User

# In-memory fallbacks (used when Redis is unavailable)
_guest_daily_hits: dict[str, deque[float]] = defaultdict(deque)
_user_daily_hits: dict[str, deque[float]] = defaultdict(deque)
_user_burst_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit_error(
    message: str,
    *,
    scope: str,
    limit: int,
    window_seconds: int,
) -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "rate_limited",
            "message": message,
            "details": {
                "scope": scope,
                "limit": limit,
                "windowSec": window_seconds,
            },
        },
    )


async def enforce_fixed_window_limit(
    *,
    scope: str,
    actor_key: str,
    max_requests: int,
    window_seconds: int,
    in_memory_buckets: dict[str, deque[float]],
    message: str,
) -> None:
    """Enforce a fixed-window rate limit using Redis or in-memory fallback."""
    max_requests = max(1, int(max_requests))
    window_seconds = max(1, int(window_seconds))
    now = time.time()

    redis_client = get_redis_client()
    if redis_client is not None:
        bucket = int(now // window_seconds)
        key = f"rl:{scope}:{actor_key}:{bucket}"
        try:
            count = int(await redis_client.incr(key))
            await redis_client.expire(key, int(window_seconds) + 5)
            if count > max_requests:
                record_ai_rate_limited(scope)
                _rate_limit_error(message, scope=scope, limit=max_requests, window_seconds=window_seconds)
            return
        except Exception:
            pass  # Redis hiccups should not take down the endpoint.

    bucket_deque = in_memory_buckets[actor_key]
    cutoff = now - window_seconds
    while bucket_deque and bucket_deque[0] < cutoff:
        bucket_deque.popleft()

    if len(bucket_deque) >= max_requests:
        record_ai_rate_limited(scope)
        _rate_limit_error(message, scope=scope, limit=max_requests, window_seconds=window_seconds)

    bucket_deque.append(now)


async def enforce_guest_daily_limit(request: Request) -> None:
    """Enforce the daily AI request limit for guest users."""
    await enforce_fixed_window_limit(
        scope="ai_guest_daily",
        actor_key=f"guest:{client_ip(request)}",
        max_requests=max(1, int(settings.ai_guest_daily_max)),
        window_seconds=max(1, int(settings.ai_guest_daily_window_sec)),
        in_memory_buckets=_guest_daily_hits,
        message="Guest daily AI limit reached",
    )


async def enforce_user_daily_limit(user: User) -> None:
    """Enforce the daily AI request limit for authenticated users."""
    await enforce_fixed_window_limit(
        scope="ai_user_daily",
        actor_key=f"user:{user.id}",
        max_requests=max(1, int(settings.ai_user_daily_max)),
        window_seconds=max(1, int(settings.ai_user_daily_window_sec)),
        in_memory_buckets=_user_daily_hits,
        message="User daily AI limit reached",
    )


async def enforce_user_burst_limit(user: User) -> None:
    """Enforce the burst (short-window) AI request limit for authenticated users."""
    await enforce_fixed_window_limit(
        scope="ai_user_burst",
        actor_key=f"user:{user.id}",
        max_requests=max(1, int(settings.ai_rate_limit_max)),
        window_seconds=max(1, int(settings.ai_rate_limit_window_sec)),
        in_memory_buckets=_user_burst_hits,
        message="User AI burst limit reached",
    )
