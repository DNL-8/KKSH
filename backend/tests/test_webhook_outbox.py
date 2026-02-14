from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from sqlmodel import select

from app.core.config import settings
from app.db import get_session
from app.models import UserWebhook, WebhookOutbox
from app.services import webhooks as webhooks_service
from app.services.webhooks import (
    OUTBOX_STATUS_DEAD,
    OUTBOX_STATUS_PENDING,
    OUTBOX_STATUS_RETRY,
    OUTBOX_STATUS_SENT,
    OUTBOX_STATUS_SHADOW,
)
from app.workers import webhook_outbox_worker as worker_module
from app.workers.webhook_outbox_worker import process_once


def _signup(client, csrf_headers, email: str):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def _create_webhook(client, csrf_headers, url: str, events: list[str]) -> dict:
    r = client.post(
        "/api/v1/webhooks",
        json={"url": url, "events": events, "isActive": True},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    return r.json()


@contextmanager
def _override_settings(**kwargs):
    old = {k: getattr(settings, k) for k in kwargs}
    try:
        for key, value in kwargs.items():
            setattr(settings, key, value)
        yield
    finally:
        for key, value in old.items():
            setattr(settings, key, value)


def _outbox_rows_for_webhook(webhook_id: str) -> list[WebhookOutbox]:
    with get_session() as session:
        return session.exec(
            select(WebhookOutbox)
            .where(WebhookOutbox.webhook_id == webhook_id)
            .order_by(WebhookOutbox.created_at.asc())
        ).all()


def _clear_outbox() -> None:
    with get_session() as session:
        rows = session.exec(select(WebhookOutbox)).all()
        for row in rows:
            session.delete(row)
        if rows:
            session.commit()


def test_webhook_shadow_mode_enqueues_and_keeps_legacy_send(client, csrf_headers, monkeypatch):
    _clear_outbox()
    with _override_settings(webhook_outbox_enabled=True, webhook_outbox_send_enabled=False):
        _signup(client, csrf_headers, "outbox-shadow@example.com")
        webhook = _create_webhook(
            client,
            csrf_headers,
            "https://example.com/outbox-shadow",
            ["session.created"],
        )

        called_urls: list[str] = []

        def _fake_send(url: str, event: str, payload: dict, secret: str | None = None, timeout_sec=None):
            _ = (event, payload, secret, timeout_sec)
            called_urls.append(url)
            return webhooks_service.WebhookDispatchResult(webhook_id="", ok=True, status_code=200)

        monkeypatch.setattr(webhooks_service, "send_webhook", _fake_send)

        created = client.post(
            "/api/v1/sessions",
            json={"subject": "SQL", "minutes": 25, "mode": "pomodoro"},
            headers=csrf_headers(),
        )
        assert created.status_code == 201

        rows = _outbox_rows_for_webhook(webhook["id"])
        assert len(rows) == 1
        assert rows[0].status == OUTBOX_STATUS_SHADOW
        assert called_urls == [webhook["url"]]


def test_webhook_outbox_mode_enqueues_pending_without_legacy_send(client, csrf_headers, monkeypatch):
    _clear_outbox()
    with _override_settings(webhook_outbox_enabled=True, webhook_outbox_send_enabled=True):
        _signup(client, csrf_headers, "outbox-pending@example.com")
        webhook = _create_webhook(
            client,
            csrf_headers,
            "https://example.com/outbox-pending",
            ["session.created"],
        )

        called_urls: list[str] = []

        def _fake_send(url: str, event: str, payload: dict, secret: str | None = None, timeout_sec=None):
            _ = (event, payload, secret, timeout_sec)
            called_urls.append(url)
            return webhooks_service.WebhookDispatchResult(webhook_id="", ok=True, status_code=200)

        monkeypatch.setattr(webhooks_service, "send_webhook", _fake_send)

        created = client.post(
            "/api/v1/sessions",
            json={"subject": "Python", "minutes": 20, "mode": "pomodoro"},
            headers=csrf_headers(),
        )
        assert created.status_code == 201

        rows = _outbox_rows_for_webhook(webhook["id"])
        assert len(rows) == 1
        assert rows[0].status == OUTBOX_STATUS_PENDING
        assert called_urls == []


def test_webhook_worker_process_once_marks_sent(client, csrf_headers, monkeypatch):
    _clear_outbox()
    with _override_settings(webhook_outbox_enabled=True, webhook_outbox_send_enabled=True):
        _signup(client, csrf_headers, "outbox-worker-sent@example.com")
        webhook = _create_webhook(
            client,
            csrf_headers,
            "https://example.com/outbox-worker-sent",
            ["session.created"],
        )

        def _fake_send(url: str, event: str, payload: dict, secret: str | None = None, timeout_sec=None):
            _ = (url, event, payload, secret, timeout_sec)
            return webhooks_service.WebhookDispatchResult(webhook_id="", ok=True, status_code=204)

        monkeypatch.setattr(worker_module, "send_webhook", _fake_send)

        created = client.post(
            "/api/v1/sessions",
            json={"subject": "Data", "minutes": 15, "mode": "pomodoro"},
            headers=csrf_headers(),
        )
        assert created.status_code == 201

        stats = process_once("worker-test-sent")
        assert stats["processed"] >= 1
        assert stats["sent"] >= 1

        rows = _outbox_rows_for_webhook(webhook["id"])
        assert len(rows) == 1
        assert rows[0].status == OUTBOX_STATUS_SENT
        assert rows[0].delivered_at is not None


def test_webhook_worker_retries_then_moves_to_dead(client, csrf_headers, monkeypatch):
    _clear_outbox()
    with _override_settings(
        webhook_outbox_enabled=True,
        webhook_outbox_send_enabled=True,
        webhook_worker_max_attempts=2,
        webhook_worker_backoff_base_sec=1,
        webhook_worker_backoff_max_sec=1,
        webhook_worker_backoff_jitter_sec=0,
    ):
        _signup(client, csrf_headers, "outbox-worker-dead@example.com")
        webhook = _create_webhook(
            client,
            csrf_headers,
            "https://example.com/outbox-worker-dead",
            ["session.created"],
        )

        def _fake_send(url: str, event: str, payload: dict, secret: str | None = None, timeout_sec=None):
            _ = (url, event, payload, secret, timeout_sec)
            return webhooks_service.WebhookDispatchResult(
                webhook_id="",
                ok=False,
                status_code=500,
                error="upstream failed",
            )

        monkeypatch.setattr(worker_module, "send_webhook", _fake_send)

        created = client.post(
            "/api/v1/sessions",
            json={"subject": "ETL", "minutes": 18, "mode": "pomodoro"},
            headers=csrf_headers(),
        )
        assert created.status_code == 201

        first = process_once("worker-test-dead")
        assert first["retried"] >= 1

        rows = _outbox_rows_for_webhook(webhook["id"])
        assert len(rows) == 1
        assert rows[0].status == OUTBOX_STATUS_RETRY

        with get_session() as session:
            row = session.get(WebhookOutbox, rows[0].id)
            assert row is not None
            row.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            session.add(row)
            session.commit()

        second = process_once("worker-test-dead")
        assert second["dead"] >= 1

        rows = _outbox_rows_for_webhook(webhook["id"])
        assert rows[0].status == OUTBOX_STATUS_DEAD
        assert int(rows[0].attempt_count or 0) >= 2


def test_webhook_worker_marks_dead_when_webhook_becomes_inactive(client, csrf_headers, monkeypatch):
    _clear_outbox()
    with _override_settings(webhook_outbox_enabled=True, webhook_outbox_send_enabled=True):
        _signup(client, csrf_headers, "outbox-worker-inactive@example.com")
        webhook = _create_webhook(
            client,
            csrf_headers,
            "https://example.com/outbox-worker-inactive",
            ["session.created"],
        )

        called = {"count": 0}

        def _fake_send(url: str, event: str, payload: dict, secret: str | None = None, timeout_sec=None):
            _ = (url, event, payload, secret, timeout_sec)
            called["count"] += 1
            return webhooks_service.WebhookDispatchResult(webhook_id="", ok=True, status_code=200)

        monkeypatch.setattr(worker_module, "send_webhook", _fake_send)

        created = client.post(
            "/api/v1/sessions",
            json={"subject": "SQL", "minutes": 11, "mode": "pomodoro"},
            headers=csrf_headers(),
        )
        assert created.status_code == 201

        with get_session() as session:
            wh = session.get(UserWebhook, webhook["id"])
            assert wh is not None
            wh.is_active = False
            session.add(wh)
            session.commit()

        stats = process_once("worker-test-inactive")
        assert stats["dead"] >= 1
        assert called["count"] == 0

        rows = _outbox_rows_for_webhook(webhook["id"])
        assert rows[0].status == OUTBOX_STATUS_DEAD
        assert rows[0].last_error == "webhook_unavailable"
