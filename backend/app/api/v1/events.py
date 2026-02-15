from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlmodel import Session

from app.core.audit import command_audit_metadata, log_event
from app.core.deps import db_session, get_current_user
from app.core.rate_limit import Rule, rate_limit
from app.models import User
from app.schemas import ApplyXpEventIn, ApplyXpEventOut
from app.services.backend_first import (
    CommandError,
    apply_xp_event,
    require_idempotency_key,
)

router = APIRouter()
_EVENT_RULE = Rule(max_requests=30, window_seconds=60)


@router.post(
    "/events",
    response_model=ApplyXpEventOut,
    dependencies=[Depends(rate_limit("events_apply", _EVENT_RULE))],
)
def create_event(
    payload: ApplyXpEventIn,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    try:
        key = require_idempotency_key(idempotency_key)
        result = apply_xp_event(
            session,
            user=user,
            event_type=payload.eventType,
            occurred_at=payload.occurredAt,
            payload=dict(payload.payload),
            source_ref=payload.sourceRef,
            idempotency_key=key,
        )
        log_event(
            session,
            request,
            "event.applied",
            user=user,
            metadata=command_audit_metadata(
                command_type="event.apply_xp",
                idempotency_key=key,
                extra={"eventType": payload.eventType},
            ),
            commit=False,
        )
        session.commit()
        return result
    except CommandError as exc:
        session.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.to_http_detail()) from exc
    except Exception:
        session.rollback()
        raise
