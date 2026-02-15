from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from fastapi import Request
from sqlmodel import Session

from app.core.config import settings
from app.core.rate_limit import client_ip
from app.core.request_context import get_request_id
from app.models import AuditEvent, User


def idempotency_key_hash(idempotency_key: str | None) -> str:
    key = (idempotency_key or "").strip()
    if not key:
        return ""
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return f"sha256:{digest[:16]}"


def command_audit_metadata(
    *,
    command_type: str,
    idempotency_key: str | None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = dict(extra or {})
    metadata["commandType"] = command_type
    metadata["idempotencyKeyHash"] = idempotency_key_hash(idempotency_key)
    return metadata


def log_event(
    session: Session,
    request: Request,
    event: str,
    user: User | None = None,
    metadata: dict[str, Any] | None = None,
    *,
    commit: bool = True,
) -> None:
    """Persist an audit event (best-effort).

    This is intentionally resilient: failures in audit logging should never block
    user requests.
    """

    if not settings.audit_enabled:
        return

    try:
        request_id = get_request_id()
        event_metadata = metadata or {}
        if request_id:
            event_metadata["request_id"] = request_id

        row = AuditEvent(
            user_id=(user.id if user else None),
            event=event,
            metadata_json=event_metadata,
            ip=client_ip(request),
            user_agent=request.headers.get("user-agent"),
            created_at=datetime.now(timezone.utc),
        )
        session.add(row)
        if commit:
            session.commit()

        # Tag Sentry with request_id for cross-system correlation
        if request_id:
            try:
                import sentry_sdk
                sentry_sdk.set_tag("request_id", request_id)
            except Exception:
                pass
    except Exception:
        # Keep audit best-effort; never break caller flow.
        # Avoid rolling back outer transactions when commit=False.
        if commit:
            session.rollback()
