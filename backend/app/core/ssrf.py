from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

FORBIDDEN_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
}


def _is_ip_forbidden(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False

    return bool(
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def _resolve_host(host: str) -> list[str]:
    # getaddrinfo returns tuples; we collect unique IPs
    ips: set[str] = set()
    for res in socket.getaddrinfo(host, None):
        sockaddr = res[4]
        if not sockaddr:
            continue
        ip = sockaddr[0]
        if ip:
            ips.add(ip)
    return sorted(ips)


def is_host_forbidden(host: str) -> bool:
    h = (host or "").strip().lower().strip(".")
    if not h:
        return True
    if h in FORBIDDEN_HOSTNAMES or h.endswith(".localhost"):
        return True

    # direct IP literal
    try:
        if _is_ip_forbidden(h):
            return True
    except Exception:
        # not an IP - continue
        pass

    # DNS resolution (best-effort). If it resolves to ANY forbidden IP, block.
    try:
        ips = _resolve_host(h)
        if not ips:
            return True
        return any(_is_ip_forbidden(ip) for ip in ips)
    except Exception:
        # Safer default: reject hosts that fail resolution.
        return True


def validate_public_http_url(url: str, *, require_https: bool = False) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("invalid_scheme")
    if require_https and parsed.scheme != "https":
        raise ValueError("https_required")
    if not parsed.netloc:
        raise ValueError("missing_host")

    host = parsed.hostname or ""
    if is_host_forbidden(host):
        raise ValueError("forbidden_host")
    return url
