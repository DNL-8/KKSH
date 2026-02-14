from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import InvalidTokenError
from sqlmodel import Session, select

from app.core.config import settings
from app.db import get_session
from app.models import (
    DailyQuest,
    StudyBlock,
    StudyPlan,
    StudySession,
    Subject,
    User,
    UserSettings,
    UserStats,
    UserWebhook,
    WeeklyQuest,
)


def db_session() -> Generator[Session, None, None]:
    with get_session() as s:
        yield s


def get_current_user(request: Request, session: Session = Depends(db_session)) -> User:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e

    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(request: Request, session: Session = Depends(db_session)) -> User | None:
    """Best-effort user resolver used by non-protected endpoints (e.g. /me).

    Returns None instead of raising 401 when the access token is missing/invalid.
    """
    token = request.cookies.get("access_token")
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
    except InvalidTokenError:
        return None

    user = session.exec(select(User).where(User.id == user_id)).first()
    return user


def is_admin(user: User) -> bool:
    # Admins are configured via ADMIN_EMAILS env (comma-separated).
    return user.email.lower() in set(settings.admin_emails_list)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def get_owned_session(
    session_id: str,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
) -> StudySession:
    row = session.exec(
        select(StudySession).where(
            StudySession.id == session_id,
            StudySession.user_id == user.id,
            StudySession.deleted_at == None,  # noqa: E711
        )
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return row


def get_owned_study_block(
    block_id: str,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
) -> StudyBlock:
    row = session.exec(
        select(StudyBlock).where(StudyBlock.id == block_id, StudyBlock.user_id == user.id)
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="StudyBlock not found")
    return row


def get_owned_subject(
    subject_id: str,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
) -> Subject:
    row = session.exec(
        select(Subject).where(Subject.id == subject_id, Subject.user_id == user.id)
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    return row


def get_owned_webhook(
    webhook_id: str,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
) -> UserWebhook:
    row = session.exec(
        select(UserWebhook).where(UserWebhook.id == webhook_id, UserWebhook.user_id == user.id)
    ).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Webhook nao encontrado"},
        )
    return row


def get_owned_daily_quest(
    quest_id: str,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
) -> DailyQuest:
    row = session.exec(
        select(DailyQuest).where(DailyQuest.id == quest_id, DailyQuest.user_id == user.id)
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found")
    return row


def get_owned_weekly_quest(
    quest_id: str,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
) -> WeeklyQuest:
    row = session.exec(
        select(WeeklyQuest).where(WeeklyQuest.id == quest_id, WeeklyQuest.user_id == user.id)
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found")
    return row


DEFAULT_GOALS: dict[str, int] = {
    "SQL": 25,
    "Python": 25,
    "Excel": 10,
    "Data Modeling": 0,
    "Cloud": 0,
    "ETL": 0,
    "Spark": 0,
    "Kafka": 0,
    "General": 0,
}


def get_or_create_study_plan(user: User, session: Session) -> StudyPlan:
    plan = session.exec(select(StudyPlan).where(StudyPlan.user_id == user.id)).first()
    if plan:
        return plan
    plan = StudyPlan(user_id=user.id, goals_json="{}", updated_at=datetime.now(timezone.utc))
    session.add(plan)
    session.commit()
    session.refresh(plan)
    return plan


def get_or_create_user_settings(user: User, session: Session) -> UserSettings:
    row = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if row:
        return row
    row = UserSettings(user_id=user.id, updated_at=datetime.now(timezone.utc))
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def get_or_create_user_stats(user: User, session: Session) -> UserStats:
    row = session.exec(select(UserStats).where(UserStats.user_id == user.id)).first()
    if row:
        return row
    row = UserStats(user_id=user.id, updated_at=datetime.now(timezone.utc))
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
