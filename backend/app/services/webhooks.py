from __future__ import annotations

import hmac
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Optional

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.core.metrics import record_webhook_outbox_enqueued
from app.core.secrets import decrypt_webhook_secret, encrypt_webhook_secret
from app.core.ssrf import validate_public_http_url
from app.db import engine
from app.models import UserWebhook, WebhookOutbox

logger = logging.getLogger("app")

OUTBOX_STATUS_SHADOW = "shadow"
OUTBOX_STATUS_PENDING = "pending"
OUTBOX_STATUS_PROCESSING = "processing"
OUTBOX_STATUS_RETRY = "retry"
OUTBOX_STATUS_SENT = "sent"
OUTBOX_STATUS_DEAD = "dead"


@dataclass
class WebhookDispatchResult:
    webhook_id: str
    ok: bool
    status_code: Optional[int] = None
    error: Optional[str] = None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_events(events_json: str) -> list[str]:
    try:
        raw = json.loads(events_json or "[]")
        if isinstance(raw, list):
            return [str(e) for e in raw]
    except Exception:
        pass
    return []


def _is_event_allowed(events_json: str, event: str) -> bool:
    events = _parse_events(events_json)
    if not events:
        return True
    return event in events


def _matching_active_webhooks(
    db: Session,
    *,
    user_id: str,
    event: str,
    webhook_id: str | None = None,
) -> list[UserWebhook]:
    stmt = select(UserWebhook).where(
        UserWebhook.user_id == user_id,
        UserWebhook.is_active.is_(True),
    )
    if webhook_id:
        stmt = stmt.where(UserWebhook.id == webhook_id)
    rows = db.exec(stmt).all()
    return [row for row in rows if _is_event_allowed(row.events_json, event)]


def list_webhooks(db: Session, user_id: str) -> list[UserWebhook]:
    return db.exec(select(UserWebhook).where(UserWebhook.user_id == user_id)).all()


def _sign(secret: str, timestamp: str, body: str) -> str:
    msg = f"{timestamp}.{body}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, sha256).hexdigest()


def get_webhook_secret(db: Session, webhook: UserWebhook) -> tuple[str | None, bool]:
    secret = decrypt_webhook_secret(webhook.secret_encrypted)
    if secret is not None:
        return secret, False
    if not webhook.secret:
        return None, False

    legacy_secret = webhook.secret
    encrypted, key_id = encrypt_webhook_secret(legacy_secret)
    webhook.secret_encrypted = encrypted
    webhook.secret_key_id = key_id
    webhook.secret = None
    db.add(webhook)
    return legacy_secret, True


def send_webhook(
    url: str,
    event: str,
    payload: dict[str, Any],
    secret: Optional[str] = None,
    timeout_sec: float | None = None,
) -> WebhookDispatchResult:
    timestamp = str(int(time.time()))
    body = json.dumps(
        {"event": event, "payload": payload, "ts": int(timestamp)},
        ensure_ascii=False,
    )

    headers = {
        "Content-Type": "application/json",
        "X-Event": event,
        "X-Timestamp": timestamp,
    }

    if secret:
        headers["X-Signature"] = _sign(secret, timestamp, body)

    try:
        require_https = settings.env not in ("dev", "test")
        validate_public_http_url(url, require_https=require_https)
        effective_timeout = (
            float(timeout_sec) if timeout_sec is not None else float(settings.webhook_delivery_timeout_sec)
        )
        resp = httpx.post(
            url,
            content=body.encode("utf-8"),
            headers=headers,
            timeout=effective_timeout,
        )
        ok = 200 <= resp.status_code < 300
        return WebhookDispatchResult(
            webhook_id="",
            ok=ok,
            status_code=resp.status_code,
            error=None if ok else resp.text,
        )
    except Exception as exc:
        return WebhookDispatchResult(webhook_id="", ok=False, status_code=None, error=str(exc))


def dispatch_event_for_user(
    db: Session,
    user_id: str,
    event: str,
    payload: dict[str, Any],
    *,
    webhook_id: str | None = None,
) -> list[WebhookDispatchResult]:
    """Dispatch a single event to all active webhooks that match the event."""

    webhooks = _matching_active_webhooks(db, user_id=user_id, event=event, webhook_id=webhook_id)

    results: list[WebhookDispatchResult] = []
    migrated_secret_rows = False
    for webhook in webhooks:
        secret, migrated = get_webhook_secret(db, webhook)
        if migrated:
            migrated_secret_rows = True
        result = send_webhook(webhook.url, event, payload, secret)
        result.webhook_id = webhook.id
        results.append(result)

    if migrated_secret_rows:
        db.commit()
    return results


def _legacy_enqueue(
    background_tasks,
    *,
    user_id: str,
    event: str,
    payload: dict[str, Any],
    webhook_id: str | None,
) -> None:
    def _task() -> None:
        with Session(engine) as db:
            dispatch_event_for_user(db, user_id, event, payload, webhook_id=webhook_id)

    if background_tasks is None:
        _task()
        return
    background_tasks.add_task(_task)


def _enqueue_outbox_rows(
    session: Session,
    *,
    mode: str,
    status: str,
    user_id: str,
    event: str,
    payload: dict[str, Any],
    targets: list[UserWebhook],
    commit: bool = True,
) -> int:
    if not targets:
        return 0

    now = _now_utc()
    count = 0
    for webhook in targets:
        row = WebhookOutbox(
            user_id=user_id,
            webhook_id=webhook.id,
            event=event,
            payload_json=dict(payload),
            status=status,
            next_attempt_at=now,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        count += 1

    if commit:
        session.commit()
    else:
        session.flush()
    record_webhook_outbox_enqueued(mode=mode, status=status, count=count)
    logger.info(
        "webhook_outbox_enqueued",
        extra={
            "mode": mode,
            "status": status,
            "count": count,
            "event": event,
            "user_id": user_id,
        },
    )
    return count


def enqueue_event(
    background_tasks,
    session: Session,
    user_id: str,
    event: str,
    payload: dict[str, Any],
    *,
    webhook_id: str | None = None,
    commit: bool = True,
) -> int:
    """Queue webhook delivery with gradual rollout to outbox.

    Returns the number of outbox rows enqueued in outbox modes, or 0 in legacy mode.
    """

    if not settings.webhook_outbox_enabled:
        _legacy_enqueue(
            background_tasks,
            user_id=user_id,
            event=event,
            payload=payload,
            webhook_id=webhook_id,
        )
        return 0

    targets = _matching_active_webhooks(
        session,
        user_id=user_id,
        event=event,
        webhook_id=webhook_id,
    )
    if not targets:
        return 0

    if settings.webhook_outbox_send_enabled:
        return _enqueue_outbox_rows(
            session,
            mode="outbox",
            status=OUTBOX_STATUS_PENDING,
            user_id=user_id,
            event=event,
            payload=payload,
            targets=targets,
            commit=commit,
        )

    # Shadow mode: enqueue for observability while keeping legacy send path active.
    count = _enqueue_outbox_rows(
        session,
        mode="shadow",
        status=OUTBOX_STATUS_SHADOW,
        user_id=user_id,
        event=event,
        payload=payload,
        targets=targets,
        commit=commit,
    )
    _legacy_enqueue(
        background_tasks,
        user_id=user_id,
        event=event,
        payload=payload,
        webhook_id=webhook_id,
    )
    return count
