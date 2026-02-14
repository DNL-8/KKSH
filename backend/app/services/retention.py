"""Retention cleanup for append-only tables.

This module provides purge functions for tables that grow without bound:
- audit_events: 90-day retention
- system_window_messages: 180-day retention, 500 per user cap
- refresh_tokens: via tokens.cleanup_expired_refresh_tokens

These can be invoked via APScheduler (see main.py lifespan) or as a standalone script.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, and_, select, func
from sqlmodel import Session

from app.models import AuditEvent, SystemWindowMessage

logger = logging.getLogger("app")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def purge_audit_events(session: Session, *, retention_days: int = 90) -> int:
    """Delete audit events older than retention_days."""
    cutoff = utcnow() - timedelta(days=retention_days)
    stmt = delete(AuditEvent).where(AuditEvent.created_at < cutoff)
    result = session.execute(stmt)
    session.commit()
    count = result.rowcount
    if count:
        logger.info("retention_purge", extra={"table": "audit_events", "deleted": count})
    return count


def purge_system_messages(
    session: Session,
    *,
    retention_days: int = 180,
    max_per_user: int = 500,
) -> int:
    """Delete system_window_messages older than retention_days + enforce per-user cap."""
    # 1) Age-based purge
    cutoff = utcnow() - timedelta(days=retention_days)
    stmt = delete(SystemWindowMessage).where(SystemWindowMessage.created_at < cutoff)
    result = session.execute(stmt)
    age_deleted = result.rowcount

    # 2) Per-user cap: keep only the newest `max_per_user` per user
    cap_deleted = 0
    over_limit = session.execute(
        select(SystemWindowMessage.user_id, func.count())
        .group_by(SystemWindowMessage.user_id)
        .having(func.count() > max_per_user)
    ).all()

    for user_id, count in over_limit:
        excess = count - max_per_user
        oldest_ids = session.execute(
            select(SystemWindowMessage.id)
            .where(SystemWindowMessage.user_id == user_id)
            .order_by(SystemWindowMessage.created_at.asc())
            .limit(excess)
        ).scalars().all()
        if oldest_ids:
            session.execute(
                delete(SystemWindowMessage).where(SystemWindowMessage.id.in_(oldest_ids))
            )
            cap_deleted += len(oldest_ids)

    session.commit()
    total = age_deleted + cap_deleted
    if total:
        logger.info(
            "retention_purge",
            extra={
                "table": "system_window_messages",
                "age_deleted": age_deleted,
                "cap_deleted": cap_deleted,
            },
        )
    return total


def run_all_retention(session: Session) -> dict[str, int]:
    """Run all retention jobs. Returns counts per table."""
    from app.services.tokens import cleanup_expired_refresh_tokens

    results = {
        "audit_events": purge_audit_events(session),
        "system_window_messages": purge_system_messages(session),
        "refresh_tokens": cleanup_expired_refresh_tokens(session),
    }
    logger.info("retention_complete", extra={"results": results})
    return results
