from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, cast

from fastapi import Response

from app.core.config import settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CookieSameSite = Literal["lax", "strict", "none"]


def _cookie_samesite() -> CookieSameSite:
    return cast(CookieSameSite, settings.cookie_samesite.lower())


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    """Set httpOnly auth cookies.

    Cookie attributes are derived from Settings so that prod hardening is centralized.
    """

    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access,
        httponly=True,
        samesite=_cookie_samesite(),
        secure=settings.cookie_secure_effective,
        max_age=int(settings.access_token_expire_min * 60),
        path=settings.cookie_path,
        domain=settings.cookie_domain_or_none,
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh,
        httponly=True,
        samesite=_cookie_samesite(),
        secure=settings.cookie_secure_effective,
        max_age=int(settings.refresh_token_expire_days * 86400),
        path=settings.cookie_path,
        domain=settings.cookie_domain_or_none,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        ACCESS_COOKIE, path=settings.cookie_path, domain=settings.cookie_domain_or_none
    )
    response.delete_cookie(
        REFRESH_COOKIE, path=settings.cookie_path, domain=settings.cookie_domain_or_none
    )


def mint_csrf_token() -> str:
    # High entropy token; stored in a readable cookie (NOT httpOnly).
    return secrets.token_urlsafe(32)


def set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=token,
        httponly=False,  # required for double-submit cookie pattern
        samesite=_cookie_samesite(),
        secure=settings.cookie_secure_effective,
        max_age=int(settings.csrf_cookie_max_age_sec),
        path=settings.cookie_path,
        domain=settings.cookie_domain_or_none,
    )


def csrf_expiry_dt() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=int(settings.csrf_cookie_max_age_sec))
