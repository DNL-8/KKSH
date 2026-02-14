from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from sqlmodel import Session, select

from app.core.config import settings
from app.core.metrics import (
    record_webhook_outbox_dead,
    record_webhook_outbox_retry,
    record_webhook_outbox_sent,
    set_webhook_outbox_depth,
)
from app.db import engine
from app.models import UserWebhook, WebhookOutbox
from app.services.webhooks import (
    OUTBOX_STATUS_DEAD,
    OUTBOX_STATUS_PENDING,
    OUTBOX_STATUS_PROCESSING,
    OUTBOX_STATUS_RETRY,
    OUTBOX_STATUS_SENT,
    get_webhook_secret,
    send_webhook,
)

logger = logging.getLogger("app")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _backoff_seconds(attempt_count: int) -> int:
    base = max(1, int(settings.webhook_worker_backoff_base_sec))
    max_sec = max(base, int(settings.webhook_worker_backoff_max_sec))
    jitter_max = max(0, int(settings.webhook_worker_backoff_jitter_sec))
    delay = min(base * (2 ** max(0, int(attempt_count) - 1)), max_sec)
    if jitter_max > 0:
        delay += random.randint(0, jitter_max)
    return int(delay)


def _claim_batch_postgres(
    session: Session,
    *,
    worker_id: str,
    now: datetime,
    limit: int,
    lock_ttl_sec: int,
) -> list[str]:
    locked_until = now + timedelta(seconds=lock_ttl_sec)
    sql = sa.text(
        """
WITH selected AS (
  SELECT id
  FROM webhook_outbox
  WHERE (
      (status IN ('pending', 'retry') AND next_attempt_at <= :now)
      OR (status = 'processing' AND locked_until < :now)
    )
    AND (locked_until IS NULL OR locked_until < :now)
  ORDER BY next_attempt_at ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT :batch_limit
)
UPDATE webhook_outbox wo
SET status = 'processing',
    locked_by = :worker_id,
    locked_until = :locked_until,
    last_attempt_at = :now,
    updated_at = :now
FROM selected
WHERE wo.id = selected.id
RETURNING wo.id
"""
    )
    rows = session.exec(
        sql,
        {
            "now": now,
            "batch_limit": int(limit),
            "worker_id": worker_id,
            "locked_until": locked_until,
        },
    ).all()
    session.commit()
    return [str(row[0]) for row in rows]


def _claim_batch_generic(
    session: Session,
    *,
    worker_id: str,
    now: datetime,
    limit: int,
    lock_ttl_sec: int,
) -> list[str]:
    locked_until = now + timedelta(seconds=lock_ttl_sec)
    candidates = session.exec(
        select(WebhookOutbox)
        .where(
            sa.or_(
                sa.and_(
                    WebhookOutbox.status.in_([OUTBOX_STATUS_PENDING, OUTBOX_STATUS_RETRY]),
                    WebhookOutbox.next_attempt_at <= now,
                ),
                sa.and_(
                    WebhookOutbox.status == OUTBOX_STATUS_PROCESSING,
                    WebhookOutbox.locked_until < now,
                ),
            ),
            sa.or_(WebhookOutbox.locked_until.is_(None), WebhookOutbox.locked_until < now),
        )
        .order_by(WebhookOutbox.next_attempt_at.asc(), WebhookOutbox.created_at.asc())
        .limit(int(limit) * 3)
    ).all()

    ids: list[str] = []
    for row in candidates:
        result = session.exec(
            sa.update(WebhookOutbox)
            .execution_options(synchronize_session=False)
            .where(
                WebhookOutbox.id == row.id,
                sa.or_(
                    sa.and_(
                        WebhookOutbox.status.in_([OUTBOX_STATUS_PENDING, OUTBOX_STATUS_RETRY]),
                        WebhookOutbox.next_attempt_at <= now,
                    ),
                    sa.and_(
                        WebhookOutbox.status == OUTBOX_STATUS_PROCESSING,
                        WebhookOutbox.locked_until < now,
                    ),
                ),
                sa.or_(WebhookOutbox.locked_until.is_(None), WebhookOutbox.locked_until < now),
            )
            .values(
                status=OUTBOX_STATUS_PROCESSING,
                locked_by=worker_id,
                locked_until=locked_until,
                last_attempt_at=now,
                updated_at=now,
            )
        )
        if int(result.rowcount or 0) == 1:
            ids.append(str(row.id))
            if len(ids) >= int(limit):
                break

    session.commit()
    return ids


def _claim_batch(session: Session, *, worker_id: str) -> list[WebhookOutbox]:
    now = _now_utc()
    batch_size = max(1, int(settings.webhook_worker_batch_size))
    lock_ttl = max(10, int(settings.webhook_worker_lock_ttl_sec))
    dialect = session.get_bind().dialect.name

    if dialect == "postgresql":
        ids = _claim_batch_postgres(
            session,
            worker_id=worker_id,
            now=now,
            limit=batch_size,
            lock_ttl_sec=lock_ttl,
        )
    else:
        ids = _claim_batch_generic(
            session,
            worker_id=worker_id,
            now=now,
            limit=batch_size,
            lock_ttl_sec=lock_ttl,
        )

    if not ids:
        return []

    rows = session.exec(select(WebhookOutbox).where(WebhookOutbox.id.in_(ids))).all()
    index = {row.id: row for row in rows}
    return [index[row_id] for row_id in ids if row_id in index]


def _set_outbox_depth(session: Session) -> None:
    rows = session.exec(
        select(WebhookOutbox.status, sa.func.count(WebhookOutbox.id)).group_by(WebhookOutbox.status)
    ).all()
    depth = {
        "shadow": 0,
        "pending": 0,
        "processing": 0,
        "retry": 0,
        "sent": 0,
        "dead": 0,
    }
    for status, count in rows:
        depth[str(status)] = int(count or 0)
    set_webhook_outbox_depth(depth)


def _release_lock(row: WebhookOutbox) -> None:
    row.locked_by = None
    row.locked_until = None


def _mark_dead(
    row: WebhookOutbox,
    *,
    now: datetime,
    error: str,
    status_code: int | None = None,
) -> str:
    row.attempt_count = int(row.attempt_count or 0) + 1
    row.status = OUTBOX_STATUS_DEAD
    row.last_attempt_at = now
    row.dead_at = now
    row.last_status_code = status_code
    row.last_error = (error or "delivery_failed").strip()[:2000]
    row.updated_at = now
    _release_lock(row)
    return OUTBOX_STATUS_DEAD


def _schedule_retry_or_dead(
    row: WebhookOutbox,
    *,
    now: datetime,
    status_code: int | None,
    error: str,
) -> str:
    row.attempt_count = int(row.attempt_count or 0) + 1
    row.last_attempt_at = now
    row.last_status_code = status_code
    row.last_error = (error or "delivery_failed").strip()[:2000]

    if row.attempt_count >= max(1, int(settings.webhook_worker_max_attempts)):
        row.status = OUTBOX_STATUS_DEAD
        row.dead_at = now
        row.updated_at = now
        _release_lock(row)
        return OUTBOX_STATUS_DEAD

    row.status = OUTBOX_STATUS_RETRY
    row.dead_at = None
    row.next_attempt_at = now + timedelta(seconds=_backoff_seconds(row.attempt_count))
    row.updated_at = now
    _release_lock(row)
    return OUTBOX_STATUS_RETRY


def _process_claimed_row(session: Session, row: WebhookOutbox) -> str:
    now = _now_utc()
    try:
        webhook = session.get(UserWebhook, row.webhook_id) if row.webhook_id else None
        if webhook is None or not bool(webhook.is_active) or webhook.user_id != row.user_id:
            outcome = _mark_dead(row, now=now, status_code=None, error="webhook_unavailable")
            session.add(row)
            session.commit()
            return outcome

        secret, _ = get_webhook_secret(session, webhook)
        payload = dict(row.payload_json or {})
        result = send_webhook(
            webhook.url,
            row.event,
            payload,
            secret=secret,
            timeout_sec=float(settings.webhook_delivery_timeout_sec),
        )
        if result.ok:
            row.status = OUTBOX_STATUS_SENT
            row.last_attempt_at = now
            row.delivered_at = now
            row.dead_at = None
            row.last_status_code = result.status_code
            row.last_error = None
            row.updated_at = now
            _release_lock(row)
            session.add(row)
            session.commit()
            return OUTBOX_STATUS_SENT

        outcome = _schedule_retry_or_dead(
            row,
            now=now,
            status_code=result.status_code,
            error=result.error or "delivery_failed",
        )
        session.add(row)
        session.commit()
        return outcome
    except Exception as exc:
        outcome = _schedule_retry_or_dead(
            row,
            now=now,
            status_code=None,
            error=f"worker_exception:{exc!r}",
        )
        session.add(row)
        session.commit()
        return outcome


def process_once(worker_id: str) -> dict[str, int]:
    stats = {
        "claimed": 0,
        "processed": 0,
        "sent": 0,
        "retried": 0,
        "dead": 0,
    }
    if not settings.webhook_outbox_enabled:
        return stats

    with Session(engine) as session:
        claimed = _claim_batch(session, worker_id=worker_id)
        stats["claimed"] = len(claimed)

        if claimed:
            logger.info(
                "webhook_outbox_claimed",
                extra={"worker_id": worker_id, "count": len(claimed)},
            )

        for row in claimed:
            outcome = _process_claimed_row(session, row)
            stats["processed"] += 1
            if outcome == OUTBOX_STATUS_SENT:
                stats["sent"] += 1
                record_webhook_outbox_sent()
                logger.info(
                    "webhook_outbox_sent",
                    extra={"worker_id": worker_id, "outbox_id": row.id, "webhook_id": row.webhook_id},
                )
            elif outcome == OUTBOX_STATUS_RETRY:
                stats["retried"] += 1
                record_webhook_outbox_retry()
                logger.info(
                    "webhook_outbox_retry",
                    extra={
                        "worker_id": worker_id,
                        "outbox_id": row.id,
                        "attempt_count": int(row.attempt_count or 0),
                        "next_attempt_at": row.next_attempt_at.isoformat()
                        if row.next_attempt_at
                        else None,
                    },
                )
            elif outcome == OUTBOX_STATUS_DEAD:
                stats["dead"] += 1
                record_webhook_outbox_dead()
                logger.info(
                    "webhook_outbox_dead",
                    extra={
                        "worker_id": worker_id,
                        "outbox_id": row.id,
                        "attempt_count": int(row.attempt_count or 0),
                        "last_error": row.last_error,
                    },
                )

        _set_outbox_depth(session)

    return stats


def run_forever(worker_id: str) -> None:
    poll_interval_sec = max(0.1, float(settings.webhook_worker_poll_interval_ms) / 1000.0)
    while True:
        process_once(worker_id=worker_id)
        time.sleep(poll_interval_sec)
