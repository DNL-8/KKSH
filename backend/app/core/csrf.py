from __future__ import annotations

from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.cookies import ACCESS_COOKIE, REFRESH_COOKIE

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def validate_csrf(request: Request) -> None:
    """Validate CSRF for cookie-auth requests.

    We use the *double-submit cookie* pattern:
    - server sets a readable cookie (csrf_token)
    - client must send the same value in header X-CSRF-Token for unsafe requests

    This blocks classic CSRF because attacker-controlled cross-site form posts cannot
    set custom headers.
    """

    if not settings.csrf_enabled:
        return

    if request.method.upper() not in UNSAFE_METHODS:
        return

    # Allow preflight and health checks without CSRF.
    # (CORS preflight is OPTIONS; handled before this function is called)
    path = request.url.path
    if path in {"/metrics", "/api/v1/health", "/api/v1/reports/web-vitals"}:
        return

    # CSRF is only required for cookie-auth flows.
    # Public or bearer-token requests without session cookies should not be blocked.
    has_auth_cookie = bool(
        request.cookies.get(ACCESS_COOKIE) or request.cookies.get(REFRESH_COOKIE)
    )
    has_csrf_cookie = bool(request.cookies.get(settings.csrf_cookie_name))
    if not has_auth_cookie and not has_csrf_cookie:
        return

    cookie_token = request.cookies.get(settings.csrf_cookie_name)
    header_token = request.headers.get(settings.csrf_header_name)
    if not cookie_token or not header_token or cookie_token != header_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "csrf_invalid",
                "message": "CSRF token missing or invalid",
                "details": {},
            },
        )
