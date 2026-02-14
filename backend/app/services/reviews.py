from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.models import DrillReview, User


def get_or_create_review(session: Session, user: User, drill_id: str) -> DrillReview:
    r = session.exec(
        select(DrillReview).where(DrillReview.user_id == user.id, DrillReview.drill_id == drill_id)
    ).first()
    if r:
        return r
    r = DrillReview(user_id=user.id, drill_id=drill_id, next_review_at=datetime.now(timezone.utc))
    session.add(r)
    session.commit()
    session.refresh(r)
    return r


def apply_review(
    session: Session,
    user: User,
    drill_id: str,
    result: str,
    *,
    elapsed_ms: int | None = None,
    difficulty: str | None = None,
) -> DrillReview:
    now = datetime.now(timezone.utc)
    r = get_or_create_review(session, user, drill_id)

    good = result == "good"

    # ---- training stats ----
    if good:
        r.good_count = int(getattr(r, "good_count", 0) or 0) + 1
    else:
        r.again_count = int(getattr(r, "again_count", 0) or 0) + 1

    if elapsed_ms is not None:
        try:
            ms = int(elapsed_ms)
            if ms < 0:
                ms = 0
            r.last_time_ms = ms
            r.total_time_ms = int(getattr(r, "total_time_ms", 0) or 0) + ms
        except Exception:
            pass

    if difficulty is not None:
        r.last_difficulty = str(difficulty)[:32]

    # SM-2-ish (simple and forgiving)
    if not good:
        r.reps = 0
        r.interval_days = 1
        r.ease = max(1.3, float(r.ease) - 0.2)
    else:
        r.reps = int(r.reps) + 1
        if r.reps == 1:
            r.interval_days = 1
        elif r.reps == 2:
            r.interval_days = 3
        else:
            r.interval_days = max(1, int(round(float(r.interval_days) * float(r.ease))))
        # Difficulty tweaks: hard = smaller boost; easy = bigger boost
        diff = (difficulty or "good").lower()
        if diff == "easy":
            delta = 0.15
        elif diff == "hard":
            delta = 0.0
        else:
            delta = 0.1
        r.ease = min(2.8, float(r.ease) + delta)

    r.last_result = result
    r.updated_at = now
    r.next_review_at = now + timedelta(days=int(r.interval_days))
    session.add(r)
    session.commit()
    session.refresh(r)
    return r


def due_reviews(session: Session, user: User, limit: int = 50) -> list[DrillReview]:
    now = datetime.now(timezone.utc)
    return session.exec(
        select(DrillReview)
        .where(DrillReview.user_id == user.id, DrillReview.next_review_at <= now)
        .order_by(DrillReview.next_review_at)
        .limit(limit)
    ).all()
