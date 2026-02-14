from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, func
from sqlmodel import Session, select

from app.core.deps import db_session, get_current_user
from app.models import Drill, DrillReview, User
from app.schemas import (
    DueDrillOut,
    ReviewQueueItemOut,
    ReviewQueueOut,
    ReviewStatsOut,
)
from app.services.reviews import due_reviews, get_or_create_review

router = APIRouter()


@router.get("/queue", response_model=ReviewQueueOut)
def get_queue(
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    due = due_reviews(session, user)
    return ReviewQueueOut(
        due=[ReviewQueueItemOut(drillId=r.drill_id, nextReviewAt=r.next_review_at) for r in due]
    )


@router.get("/due", response_model=list[DueDrillOut])
def list_due_drills(
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    rows = session.exec(
        select(DrillReview, Drill)
        .join(Drill, Drill.id == DrillReview.drill_id)
        .where(
            DrillReview.user_id == user.id,
            DrillReview.next_review_at <= now,
            Drill.is_active == True,  # noqa: E712
        )
        .order_by(DrillReview.next_review_at)
        .limit(limit)
    ).all()

    out: list[DueDrillOut] = []
    for r, d in rows:
        # Skip inactive drills, but keep imported/custom drills if present in DB.
        if d is None:
            continue
        out.append(
            DueDrillOut(
                drillId=r.drill_id,
                subject=str(d.subject),
                question=str(d.question),
                answer=str(d.answer),
                nextReviewAt=r.next_review_at,
                intervalDays=int(r.interval_days),
                reps=int(r.reps),
                ease=float(r.ease),
            )
        )
    return out


@router.get("/stats", response_model=ReviewStatsOut)
def get_review_stats(
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    # Aggregate from DrillReview counters (all-time) using SQL
    agg = session.exec(
        select(
            func.coalesce(func.sum(DrillReview.good_count), 0),
            func.coalesce(func.sum(DrillReview.again_count), 0),
            func.coalesce(func.sum(DrillReview.total_time_ms), 0),
            func.coalesce(func.sum(case((DrillReview.reps <= 0, 1), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                DrillReview.reps > 0,
                                (DrillReview.reps <= 2) | (DrillReview.interval_days < 7),
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(DrillReview.reps > 2, DrillReview.interval_days >= 7),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
        ).where(DrillReview.user_id == user.id)
    ).one()

    good_count = int(agg[0] or 0)
    again_count = int(agg[1] or 0)
    total_time = int(agg[2] or 0)
    new_count = int(agg[3] or 0)
    learning_count = int(agg[4] or 0)
    mature_count = int(agg[5] or 0)

    total_answered = good_count + again_count

    now = datetime.now(timezone.utc)
    due_count = int(
        session.exec(
            select(func.count())
            .select_from(DrillReview)
            .where(DrillReview.user_id == user.id, DrillReview.next_review_at <= now)
        ).one()
        or 0
    )

    good_rate = float(good_count) / float(total_answered) if total_answered else 0.0
    avg_time = float(total_time) / float(total_answered) if total_answered else None

    return ReviewStatsOut(
        dueCount=due_count,
        totalAnswered=total_answered,
        goodCount=good_count,
        againCount=again_count,
        goodRate=good_rate,
        avgTimeMs=avg_time,
        maturity={"new": new_count, "learning": learning_count, "mature": mature_count},
    )


@router.post("/dev/force-due", status_code=204)
def dev_force_due_review(
    drillId: str = "sql-joins-1",  # noqa: N803
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    """DEV/TEST ONLY helper used by e2e.

    Forces a drill review to become due (next_review_at in the past).
    """

    env = (os.getenv("ENV") or "").lower()
    if env not in {"dev", "test"}:
        raise HTTPException(status_code=404, detail="Not found")

    r = get_or_create_review(session, user, drillId)
    r.next_review_at = datetime.now(timezone.utc) - timedelta(days=1)
    session.add(r)
    session.commit()
    return None
