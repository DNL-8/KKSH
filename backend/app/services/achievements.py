from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from sqlmodel import Session, select

from app.models import DrillReview, StudySession, User, UserAchievement


@dataclass(frozen=True)
class AchievementDef:
    key: str
    name: str
    description: str
    icon: Optional[str]
    predicate: Callable[[dict[str, int]], bool]


def _review_count(db: Session, user_id: str) -> int:
    return len(db.exec(select(DrillReview.id).where(DrillReview.user_id == user_id)).all())


def _session_rows(db: Session, user_id: str) -> list[tuple[str, int]]:
    return db.exec(
        select(StudySession.date_key, StudySession.minutes).where(
            StudySession.user_id == user_id,
            StudySession.deleted_at.is_(None),
        )
    ).all()


def _streak_days(rows: list[tuple[str, int]]) -> int:
    if not rows:
        return 0

    totals: dict[str, int] = {}
    for dk, minutes in rows:
        totals[str(dk)] = totals.get(str(dk), 0) + int(minutes or 0)

    streak = 0
    cursor = datetime.now(timezone.utc).date()
    while True:
        key = cursor.strftime("%Y-%m-%d")
        if totals.get(key, 0) <= 0:
            break
        streak += 1
        cursor = cursor - timedelta(days=1)
        if streak > 365:
            break
    return streak


def _metrics(db: Session, user_id: str) -> dict[str, int]:
    rows = _session_rows(db, user_id)
    return {
        "total_sessions": len(rows),
        "total_minutes": int(sum(int(minutes or 0) for _, minutes in rows)),
        "streak_days": _streak_days(rows),
        "review_count": _review_count(db, user_id),
    }


ACHIEVEMENTS: list[AchievementDef] = [
    AchievementDef(
        key="first_session",
        name="Primeira Sessao",
        description="Registre sua primeira sessao de estudo.",
        icon="sparkles",
        predicate=lambda m: m["total_sessions"] >= 1,
    ),
    AchievementDef(
        key="ten_sessions",
        name="Ritmo de Cacador",
        description="Complete 10 sessoes de estudo.",
        icon="trending-up",
        predicate=lambda m: m["total_sessions"] >= 10,
    ),
    AchievementDef(
        key="hundred_minutes",
        name="100 Minutos",
        description="Acumule 100 minutos estudando.",
        icon="clock",
        predicate=lambda m: m["total_minutes"] >= 100,
    ),
    AchievementDef(
        key="streak_3",
        name="Sequencia 3 Dias",
        description="Mantenha uma sequencia de 3 dias.",
        icon="flame",
        predicate=lambda m: m["streak_days"] >= 3,
    ),
    AchievementDef(
        key="streak_7",
        name="Sequencia 7 Dias",
        description="Mantenha uma sequencia de 7 dias.",
        icon="flame",
        predicate=lambda m: m["streak_days"] >= 7,
    ),
    AchievementDef(
        key="first_review",
        name="Primeira Revisao",
        description="Faca sua primeira revisao espacada.",
        icon="check",
        predicate=lambda m: m["review_count"] >= 1,
    ),
    AchievementDef(
        key="ten_reviews",
        name="Memoria de Acao",
        description="Conclua 10 revisoes espacadas.",
        icon="brain",
        predicate=lambda m: m["review_count"] >= 10,
    ),
]


def list_and_unlock_achievements(db: Session, user: User) -> list[dict]:
    """Return achievements with unlock status and persist new unlocks."""

    metrics = _metrics(db, user.id)
    unlocked_rows = db.exec(select(UserAchievement).where(UserAchievement.user_id == user.id)).all()
    unlocked_by_key = {row.key: row for row in unlocked_rows}

    changed = False
    result: list[dict] = []

    for ach in ACHIEVEMENTS:
        is_unlocked = bool(unlocked_by_key.get(ach.key))
        if not is_unlocked and ach.predicate(metrics):
            row = UserAchievement(user_id=user.id, key=ach.key)
            db.add(row)
            db.flush()
            unlocked_by_key[ach.key] = row
            is_unlocked = True
            changed = True

        row = unlocked_by_key.get(ach.key)
        result.append(
            {
                "key": ach.key,
                "name": ach.name,
                "description": ach.description,
                "icon": ach.icon,
                "unlocked": is_unlocked,
                "unlockedAt": row.unlocked_at if row else None,
            }
        )

    if changed:
        db.commit()

    return result
