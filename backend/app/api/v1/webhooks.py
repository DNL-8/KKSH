from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlmodel import Session, select

from app.core.config import settings
from app.core.deps import db_session, get_current_user, get_owned_webhook
from app.core.rate_limit import Rule, rate_limit
from app.core.secrets import encrypt_webhook_secret
from app.core.ssrf import validate_public_http_url
from app.models import User, UserWebhook
from app.schemas import WebhookCreateIn, WebhookOut, WebhookUpdateIn
from app.services.webhooks import enqueue_event

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
_WEBHOOK_MUTATION_RULE = Rule(max_requests=20, window_seconds=60)


def _validate_url(url: str) -> str:
    try:
        # In prod/staging, prefer HTTPS-only.
        require_https = settings.env not in ("dev", "test")
        validate_public_http_url(url, require_https=require_https)
    except ValueError as e:
        code = str(e) or "invalid_url"
        msg = "URL invalida"
        if code == "https_required":
            msg = "Em producao, apenas URLs https:// sao permitidas"
        elif code == "forbidden_host":
            msg = "Host nao permitido (localhost/IP privado bloqueado)"
        raise HTTPException(status_code=400, detail={"code": "invalid_url", "message": msg}) from e
    except Exception as err:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_url", "message": "URL invalida"},
        ) from err
    return url


@router.get("", response_model=list[WebhookOut])
def list_webhooks(
    db: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    rows = db.exec(select(UserWebhook).where(UserWebhook.user_id == user.id)).all()
    out: list[WebhookOut] = []
    for wh in rows:
        try:
            events = json.loads(wh.events_json or "[]")
            if not isinstance(events, list):
                events = []
        except Exception:
            events = []
        out.append(
            WebhookOut(
                id=wh.id,
                url=wh.url,
                events=[str(e) for e in events],
                isActive=bool(wh.is_active),
                createdAt=wh.created_at,
                updatedAt=wh.updated_at,
            )
        )
    return out


@router.post(
    "",
    response_model=WebhookOut,
    dependencies=[Depends(rate_limit("webhooks_create", _WEBHOOK_MUTATION_RULE))],
)
def create_webhook(
    payload: WebhookCreateIn,
    db: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    url = _validate_url(payload.url)
    encrypted_secret = None
    key_id = None
    if payload.secret:
        encrypted_secret, key_id = encrypt_webhook_secret(payload.secret)
    wh = UserWebhook(
        user_id=user.id,
        url=url,
        events_json=json.dumps(payload.events or []),
        secret=None,
        secret_encrypted=encrypted_secret,
        secret_key_id=key_id,
        is_active=payload.isActive,
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)

    return WebhookOut(
        id=wh.id,
        url=wh.url,
        events=payload.events or [],
        isActive=bool(wh.is_active),
        createdAt=wh.created_at,
        updatedAt=wh.updated_at,
    )


@router.patch(
    "/{webhook_id}",
    response_model=WebhookOut,
    dependencies=[Depends(rate_limit("webhooks_update", _WEBHOOK_MUTATION_RULE))],
)
def update_webhook(
    payload: WebhookUpdateIn,
    wh: UserWebhook = Depends(get_owned_webhook),
    db: Session = Depends(db_session),
):
    if payload.url is not None:
        wh.url = _validate_url(payload.url)
    if payload.events is not None:
        wh.events_json = json.dumps(payload.events)
    if payload.secret is not None:
        if payload.secret.strip():
            encrypted_secret, key_id = encrypt_webhook_secret(payload.secret)
            wh.secret_encrypted = encrypted_secret
            wh.secret_key_id = key_id
            wh.secret = None
        else:
            wh.secret_encrypted = None
            wh.secret_key_id = None
            wh.secret = None
    if payload.isActive is not None:
        wh.is_active = payload.isActive

    db.add(wh)
    db.commit()
    db.refresh(wh)

    try:
        events = json.loads(wh.events_json or "[]")
        if not isinstance(events, list):
            events = []
    except Exception:
        events = []

    return WebhookOut(
        id=wh.id,
        url=wh.url,
        events=[str(e) for e in events],
        isActive=bool(wh.is_active),
        createdAt=wh.created_at,
        updatedAt=wh.updated_at,
    )


@router.delete(
    "/{webhook_id}",
    dependencies=[Depends(rate_limit("webhooks_delete", _WEBHOOK_MUTATION_RULE))],
)
def delete_webhook(
    wh: UserWebhook = Depends(get_owned_webhook),
    db: Session = Depends(db_session),
):
    db.delete(wh)
    db.commit()
    return {"ok": True}


@router.post(
    "/{webhook_id}/test",
    dependencies=[Depends(rate_limit("webhooks_test", _WEBHOOK_MUTATION_RULE))],
)
def test_webhook(
    background: BackgroundTasks,
    db: Session = Depends(db_session),
    user: User = Depends(get_current_user),
    wh: UserWebhook = Depends(get_owned_webhook),
):
    enqueue_event(background, db, user.id, "test", {"hello": "world"}, webhook_id=wh.id)
    return {"ok": True}
