from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.deps import db_session, get_current_user, get_or_create_study_plan
from app.models import User
from app.schemas import StudyPlanIn, StudyPlanOut
from app.services.utils import dump_goals, parse_goals

router = APIRouter()


@router.get("", response_model=StudyPlanOut)
def get_plan(session: Session = Depends(db_session), user: User = Depends(get_current_user)):
    plan = get_or_create_study_plan(user, session)
    return StudyPlanOut(goals=parse_goals(plan.goals_json))


@router.put("", status_code=204)
def update_plan(
    payload: StudyPlanIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    plan = get_or_create_study_plan(user, session)
    plan.goals_json = dump_goals(payload.goals)
    plan.updated_at = datetime.now(timezone.utc)
    session.add(plan)
    session.commit()
    return None
