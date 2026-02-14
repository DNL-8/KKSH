from sqlmodel import select

from app.db import get_session
from app.models import UserWebhook
from app.services import webhooks as webhooks_service


def _signup(client, csrf_headers, email="webhooks@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_webhook_test_endpoint_dispatches_only_target_webhook(client, csrf_headers, monkeypatch):
    _signup(client, csrf_headers)

    first = client.post(
        "/api/v1/webhooks",
        json={"url": "https://example.com/hook-a", "events": ["test"], "isActive": True},
        headers=csrf_headers(),
    )
    assert first.status_code == 200
    first_data = first.json()

    second = client.post(
        "/api/v1/webhooks",
        json={"url": "https://example.com/hook-b", "events": ["test"], "isActive": True},
        headers=csrf_headers(),
    )
    assert second.status_code == 200
    second_data = second.json()

    called_urls: list[str] = []

    def _fake_send(url: str, event: str, payload: dict, secret: str | None = None):
        _ = (event, payload, secret)
        called_urls.append(url)
        return webhooks_service.WebhookDispatchResult(webhook_id="", ok=True, status_code=200)

    monkeypatch.setattr(webhooks_service, "send_webhook", _fake_send)

    tested = client.post(f"/api/v1/webhooks/{first_data['id']}/test", headers=csrf_headers())
    assert tested.status_code == 200
    assert tested.json()["ok"] is True

    assert called_urls == [first_data["url"]]
    assert second_data["url"] not in called_urls


def test_webhook_secret_is_not_stored_in_plaintext(client, csrf_headers):
    _signup(client, csrf_headers, email="webhooks-secret@example.com")

    created = client.post(
        "/api/v1/webhooks",
        json={
            "url": "https://example.com/hook-secret",
            "events": ["test"],
            "secret": "super-secret-value",
            "isActive": True,
        },
        headers=csrf_headers(),
    )
    assert created.status_code == 200
    webhook_id = created.json()["id"]

    with get_session() as session:
        row = session.exec(select(UserWebhook).where(UserWebhook.id == webhook_id)).first()
        assert row is not None
        assert row.secret is None
        assert row.secret_encrypted is not None
        assert row.secret_key_id is not None
