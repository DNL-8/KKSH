from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlmodel import Session, select

from app.core.audit import log_event
from app.core.deps import db_session, get_current_user
from app.models import DailyQuest, User
from app.services.backend_first import CommandError, claim_mission_reward

router = APIRouter()


@router.post("/{quest_id}/claim", status_code=204)
def claim_quest(
    request: Request,
    quest_id: str,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    quest = session.exec(
        select(DailyQuest).where(DailyQuest.id == quest_id, DailyQuest.user_id == user.id)
    ).first()
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")

    key = (idempotency_key or "").strip() or f"legacy-daily-{quest_id}-{uuid4()}"
    try:
        claim_mission_reward(
            session,
            user=user,
            mission_instance_id=quest_id,
            idempotency_key=key,
        )
        log_event(
            session,
            request,
            "quest.claim",
            user=user,
            metadata={"questId": quest_id, "date": quest.date_key},
            commit=False,
        )
        session.commit()
    except CommandError as exc:
        session.rollback()
        if exc.code == "mission_already_claimed":
            return None
        if exc.code == "mission_not_completed":
            raise HTTPException(status_code=400, detail="Quest not completed") from exc
        raise HTTPException(status_code=exc.status_code, detail=exc.to_http_detail()) from exc
    except Exception:
        session.rollback()
        raise
    if bool(quest.claimed):
        return None
    return None
