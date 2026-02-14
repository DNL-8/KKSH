from __future__ import annotations

import logging
from datetime import timedelta
from typing import Literal

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.deps import db_session, get_current_user, get_optional_user
from app.core.rate_limit import Rule, client_ip, rate_limit
from app.models import StudySession, User
from app.schemas import (
    MonthlyReportOut,
    MonthlyReportRowOut,
    WeeklyReportDayOut,
    WeeklyReportOut,
    WeeklyReportSubjectOut,
)
from app.services.utils import now_local

router = APIRouter()
logger = logging.getLogger("app")
_WEB_VITALS_RULE = Rule(max_requests=120, window_seconds=60)


class WebVitalIn(BaseModel):
    name: Literal["CLS", "INP", "LCP"] = Field(..., description="Web Vitals metric name")
    value: float = Field(..., ge=0)
    rating: Literal["good", "needs-improvement", "poor"]
    id: str = Field(..., min_length=1, max_length=128)
    path: str = Field(..., min_length=1, max_length=512)
    userAgent: str | None = Field(default=None, max_length=512)


@router.post(
    "/web-vitals",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(rate_limit("reports_web_vitals", _WEB_VITALS_RULE))],
)
def ingest_web_vitals(
    payload: WebVitalIn,
    request: Request,
    user: User | None = Depends(get_optional_user),
):
    logger.info(
        "web_vitals",
        extra={
            "metric": payload.name,
            "value": round(payload.value, 4),
            "rating": payload.rating,
            "path": payload.path,
            "user_id": user.id if user else None,
            "ip": client_ip(request),
            "ua": payload.userAgent or request.headers.get("user-agent"),
        },
    )
    return {"ok": True}


@router.get("/weekly", response_model=WeeklyReportOut)
def weekly_report(
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    end = now_local().date()
    start = end - timedelta(days=6)
    start_key = start.strftime("%Y-%m-%d")
    end_key = end.strftime("%Y-%m-%d")
    keys = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    rows = session.exec(
        select(
            StudySession.date_key,
            StudySession.subject,
            func.coalesce(func.sum(StudySession.minutes), 0),
        )
        .where(
            StudySession.user_id == user.id,
            StudySession.deleted_at.is_(None),
            StudySession.date_key >= start_key,
            StudySession.date_key <= end_key,
        )
        .group_by(StudySession.date_key, StudySession.subject)
    ).all()

    by_day = {k: 0 for k in keys}
    by_subject: dict[str, int] = {}
    for dk, subject, minutes in rows:
        if dk in by_day:
            by_day[dk] += int(minutes or 0)
        by_subject[str(subject)] = by_subject.get(str(subject), 0) + int(minutes or 0)

    total = sum(by_day.values())

    # streak: consecutive days ending today
    streak_start_key = (end - timedelta(days=365)).strftime("%Y-%m-%d")
    streak_rows = session.exec(
        select(
            StudySession.date_key,
            func.coalesce(func.sum(StudySession.minutes), 0),
        )
        .where(
            StudySession.user_id == user.id,
            StudySession.deleted_at.is_(None),
            StudySession.date_key >= streak_start_key,
            StudySession.date_key <= end_key,
        )
        .group_by(StudySession.date_key)
    ).all()

    streak = 0
    cursor = end
    minutes_map = {str(dk): int(minutes or 0) for dk, minutes in streak_rows}
    while minutes_map.get(cursor.strftime("%Y-%m-%d"), 0) > 0:
        streak += 1
        cursor = cursor - timedelta(days=1)
        if streak > 365:
            break

    return WeeklyReportOut(
        **{
            "from": start.strftime("%Y-%m-%d"),
            "to": end.strftime("%Y-%m-%d"),
            "totalMinutes": int(total),
            "byDay": [WeeklyReportDayOut(date=k, minutes=int(by_day[k])) for k in keys],
            "bySubject": [
                WeeklyReportSubjectOut(subject=s, minutes=int(m))
                for s, m in sorted(by_subject.items(), key=lambda x: x[1], reverse=True)
            ],
            "streakDays": int(streak),
        }
    )


@router.get("/monthly", response_model=MonthlyReportOut)
def monthly_report(
    months: int = 12,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    """Monthly aggregation.

    Uses DB views when available (created by Alembic), otherwise falls back to in-memory grouping.
    """
    months = max(1, min(int(months), 36))

    # Try the view first
    try:
        stmt = sa.text(
            "SELECT month_key, minutes, sessions, xp, gold "
            "FROM v_user_monthly_stats WHERE user_id = :uid "
            "ORDER BY month_key DESC LIMIT :lim"
        )
        res = session.exec(stmt, {"uid": user.id, "lim": months}).all()
        out = [
            MonthlyReportRowOut(
                month=str(r[0]),
                minutes=int(r[1] or 0),
                sessions=int(r[2] or 0),
                xp=int(r[3] or 0),
                gold=int(r[4] or 0),
            )
            for r in res
        ]
        return {"months": out}
    except Exception:
        pass

    # Fallback (works with AUTO_CREATE_DB / SQLite)
    rows = session.exec(
        select(
            StudySession.date_key,
            StudySession.minutes,
            StudySession.xp_earned,
            StudySession.gold_earned,
        ).where(StudySession.user_id == user.id, StudySession.deleted_at.is_(None))
    ).all()

    agg: dict[str, dict[str, int]] = {}
    for date_key, minutes_val, xp_val, gold_val in rows:
        month_key = str(date_key)[:7]
        if month_key not in agg:
            agg[month_key] = {"minutes": 0, "sessions": 0, "xp": 0, "gold": 0}
        agg[month_key]["minutes"] += int(minutes_val or 0)
        agg[month_key]["sessions"] += 1
        agg[month_key]["xp"] += int(xp_val or 0)
        agg[month_key]["gold"] += int(gold_val or 0)

    # sort and limit
    keys = sorted(agg.keys(), reverse=True)[:months]
    return {
        "months": [
            MonthlyReportRowOut(
                month=k,
                minutes=agg[k]["minutes"],
                sessions=agg[k]["sessions"],
                xp=agg[k]["xp"],
                gold=agg[k]["gold"],
            )
            for k in keys
        ]
    }
