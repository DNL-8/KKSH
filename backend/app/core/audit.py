from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Request
from sqlmodel import Session

from app.core.config import settings
from app.core.rate_limit import client_ip
from app.models import AuditEvent, User


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
        row = AuditEvent(
            user_id=(user.id if user else None),
            event=event,
            metadata_json=metadata or {},
            ip=client_ip(request),
            user_agent=request.headers.get("user-agent"),
            created_at=datetime.now(timezone.utc),
        )
        session.add(row)
        if commit:
            session.commit()
    except Exception:
        # Keep audit best-effort; never break caller flow.
        # Avoid rolling back outer transactions when commit=False.
        if commit:
            session.rollback()
