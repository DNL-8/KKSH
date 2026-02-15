from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.deps import db_session, get_current_user, get_or_create_user_settings, is_admin
from app.models import User, UserSettings
from app.schemas import UpdateSettingsIn, UserSettingsOut

router = APIRouter()


def _row_to_out(row) -> UserSettingsOut:
    return UserSettingsOut(
        dailyTargetMinutes=int(row.daily_target_minutes),
        pomodoroWorkMin=int(row.pomodoro_work_min),
        pomodoroBreakMin=int(row.pomodoro_break_min),
        timezone=row.timezone,
        language=getattr(row, "language", "pt-BR"),
        reminderEnabled=bool(getattr(row, "reminder_enabled", True)),
        reminderTime=getattr(row, "reminder_time", "20:00"),
        reminderEveryMin=int(getattr(row, "reminder_every_min", 5)),
        xpPerMinute=int(getattr(row, "xp_per_minute", 5)),
        goldPerMinute=int(getattr(row, "gold_per_minute", 1)),
    )


@router.get("", response_model=UserSettingsOut)
def get_settings(session: Session = Depends(db_session), user: User = Depends(get_current_user)):
    row = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    if row is None:
        return UserSettingsOut(
            dailyTargetMinutes=60,
            pomodoroWorkMin=25,
            pomodoroBreakMin=5,
            timezone="America/Sao_Paulo",
            language="pt-BR",
            reminderEnabled=True,
            reminderTime="20:00",
            reminderEveryMin=5,
            xpPerMinute=5,
            goldPerMinute=1,
        )
    return _row_to_out(row)


@router.put("", response_model=UserSettingsOut)
def update_settings(
    payload: UpdateSettingsIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    row = get_or_create_user_settings(user, session)

    if payload.dailyTargetMinutes is not None:
        row.daily_target_minutes = int(payload.dailyTargetMinutes)
    if payload.pomodoroWorkMin is not None:
        row.pomodoro_work_min = int(payload.pomodoroWorkMin)
    if payload.pomodoroBreakMin is not None:
        row.pomodoro_break_min = int(payload.pomodoroBreakMin)
    if payload.timezone is not None:
        row.timezone = payload.timezone
    if payload.language is not None:
        row.language = payload.language
    if payload.reminderEnabled is not None:
        row.reminder_enabled = bool(payload.reminderEnabled)
    if payload.reminderTime is not None:
        row.reminder_time = payload.reminderTime
    if payload.reminderEveryMin is not None:
        row.reminder_every_min = int(payload.reminderEveryMin)
    if is_admin(user) and payload.xpPerMinute is not None:
        row.xp_per_minute = int(payload.xpPerMinute)
    if is_admin(user) and payload.goldPerMinute is not None:
        row.gold_per_minute = int(payload.goldPerMinute)

    row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    session.commit()
    session.refresh(row)
    return _row_to_out(row)
