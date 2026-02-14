from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.deps import (
    db_session,
    get_current_user,
    get_or_create_study_plan,
    get_or_create_user_settings,
    get_or_create_user_stats,
)
from app.models import User
from app.schemas import OnboardingCompleteIn, OnboardingStatusOut, UserSettingsOut
from app.services.subjects import ensure_subjects_from_goals
from app.services.utils import dump_goals, parse_goals

router = APIRouter()


@router.get("/status", response_model=OnboardingStatusOut)
def onboarding_status(
    session: Session = Depends(db_session), user: User = Depends(get_current_user)
):
    plan = get_or_create_study_plan(user, session)
    settings_row = get_or_create_user_settings(user, session)

    return OnboardingStatusOut(
        onboardingDone=bool(getattr(user, "onboarding_done", False)),
        goals=parse_goals(plan.goals_json),
        settings=UserSettingsOut(
            dailyTargetMinutes=int(settings_row.daily_target_minutes),
            pomodoroWorkMin=int(settings_row.pomodoro_work_min),
            pomodoroBreakMin=int(settings_row.pomodoro_break_min),
            timezone=settings_row.timezone,
        ),
    )


@router.post("/complete", status_code=204)
def complete_onboarding(
    payload: OnboardingCompleteIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    # update plan
    plan = get_or_create_study_plan(user, session)
    plan.goals_json = dump_goals(payload.goals)
    plan.updated_at = datetime.now(timezone.utc)
    session.add(plan)

    # update settings
    settings_row = get_or_create_user_settings(user, session)
    settings_row.daily_target_minutes = int(payload.dailyTargetMinutes)
    settings_row.pomodoro_work_min = int(payload.pomodoroWorkMin)
    settings_row.pomodoro_break_min = int(payload.pomodoroBreakMin)
    settings_row.timezone = payload.timezone
    settings_row.updated_at = datetime.now(timezone.utc)
    session.add(settings_row)

    # ensure core rows exist
    get_or_create_user_stats(session, user)
    ensure_subjects_from_goals(session, user, payload.goals)

    # mark user
    user.onboarding_done = True
    session.add(user)

    session.commit()
    return None
