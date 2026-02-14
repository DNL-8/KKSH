from starlette.requests import Request

from app.core.config import settings
from app.core.rate_limit import client_ip


def _mk_request(*, client_host: str, headers: dict[str, str] | None = None) -> Request:
    raw_headers = []
    for k, v in (headers or {}).items():
        raw_headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": raw_headers,
        "client": (client_host, 12345),
        "server": ("testserver", 80),
    }
    return Request(scope)


def test_client_ip_ignores_xff_when_proxy_not_trusted():
    prev = settings.trusted_proxy_ips
    settings.trusted_proxy_ips = ""
    try:
        req = _mk_request(
            client_host="203.0.113.10",
            headers={"x-forwarded-for": "198.51.100.77"},
        )
        assert client_ip(req) == "203.0.113.10"
    finally:
        settings.trusted_proxy_ips = prev


def test_client_ip_uses_xff_when_proxy_is_trusted():
    prev = settings.trusted_proxy_ips
    settings.trusted_proxy_ips = "203.0.113.10"
    try:
        req = _mk_request(
            client_host="203.0.113.10",
            headers={"x-forwarded-for": "198.51.100.77, 192.0.2.1"},
        )
        assert client_ip(req) == "198.51.100.77"
    finally:
        settings.trusted_proxy_ips = prev
