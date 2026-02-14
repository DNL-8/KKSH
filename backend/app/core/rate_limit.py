from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, DefaultDict, Deque

from fastapi import HTTPException, Request, status

from app.core.config import settings


@dataclass
class Rule:
    max_requests: int
    window_seconds: int


class InMemoryRateLimiter:
    """
    Simple in-memory fixed-window rate limiter.
    Good for dev/single-instance deployments.

    NOTE: In multi-replica production you should use a shared store (Redis) instead.
    """

    def __init__(self) -> None:
        self._buckets: DefaultDict[str, Deque[float]] = defaultdict(deque)

    def hit(self, key: str, rule: Rule) -> bool:
        now = time.time()
        bucket = self._buckets[key]
        # drop expired
        cutoff = now - rule.window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= rule.max_requests:
            return False
        bucket.append(now)
        return True


limiter = InMemoryRateLimiter()


# Optional Redis backend (multi-instance safe).
_redis: Any | None = None


def init_redis() -> None:
    """Initialize Redis client if REDIS_URL is set.

    This is idempotent and safe to call on startup.
    """

    global _redis
    if _redis is not None:
        return
    if not settings.redis_url:
        return
    try:
        import redis.asyncio as redis

        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        # If Redis is misconfigured/unavailable, fall back to in-memory.
        _redis = None


def get_redis_client() -> Any | None:
    return _redis


def client_ip(request: Request) -> str:
    trusted_proxies = set(settings.trusted_proxy_ips_list)
    direct_peer = request.client.host if request.client else None

    # Use proxy headers only when the direct peer is trusted.
    xff = request.headers.get("x-forwarded-for")
    if xff and direct_peer and direct_peer in trusted_proxies:
        return xff.split(",")[0].strip()
    if direct_peer:
        return direct_peer
    return "unknown"


def rate_limit(name: str, rule: Rule | None = None) -> Callable[[Request], Awaitable[None]]:
    if rule is None:
        rule = Rule(
            max_requests=int(settings.rate_limit_default_max),
            window_seconds=int(settings.rate_limit_default_window_sec),
        )

    async def _dep(request: Request) -> None:
        ip = client_ip(request)

        # Use Redis if configured; otherwise, use in-memory.
        if _redis is not None:
            bucket = int(time.time() // rule.window_seconds)
            key = f"rl:{name}:{ip}:{bucket}"
            try:
                # Fixed window counter; set TTL on every hit (cheap + safe).
                count = int(await _redis.incr(key))
                await _redis.expire(key, int(rule.window_seconds) + 5)
                ok = count <= rule.max_requests
            except Exception:
                # If Redis fails at runtime, degrade gracefully.
                ok = limiter.hit(f"{name}:{ip}", rule)
        else:
            ok = limiter.hit(f"{name}:{ip}", rule)

        if not ok:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "rate_limited",
                    "message": "Too many requests. Please try again later.",
                    "details": {"name": name},
                },
            )

    return _dep
