from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.deps import db_session, get_current_user
from app.models import User
from app.schemas import LeaderboardOut, ProgressQueryOut, XpHistoryOut
from app.services.backend_first import (
    get_progress_payload,
    leaderboard_payload,
    list_xp_history_payload,
)

router = APIRouter()


@router.get("/progress", response_model=ProgressQueryOut)
def get_progress(
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    return get_progress_payload(session, user=user)


@router.get("/history/xp", response_model=XpHistoryOut)
def get_xp_history(
    from_: str | None = Query(default=None, alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    limit: int = Query(default=100, ge=1, le=200),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    return list_xp_history_payload(
        session,
        user=user,
        date_from=from_,
        date_to=to,
        limit=limit,
    )


@router.get("/leaderboard", response_model=LeaderboardOut)
def get_leaderboard(
    scope: Literal["weekly"] = Query(default="weekly"),
    limit: int = Query(default=50, ge=1, le=100),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),  # noqa: ARG001 - keeps endpoint authenticated
):
    return leaderboard_payload(session, scope=scope, limit=limit)

