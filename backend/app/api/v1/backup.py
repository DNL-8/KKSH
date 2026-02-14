from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, delete, select

from app.core.deps import db_session, get_current_user
from app.core.rate_limit import Rule, rate_limit
from app.models import DailyQuest, Drill, DrillReview, StudyPlan, StudySession, User
from app.schemas import BackupImportIn, BackupOut, UserOut
from app.services.utils import dump_goals, parse_goals

router = APIRouter()
_BACKUP_IMPORT_RULE = Rule(max_requests=2, window_seconds=60)
_MAX_BACKUP_IMPORT_BYTES = 1_000_000
_MAX_GOALS = 100
_MAX_BACKUP_SESSIONS = 5000
_MAX_BACKUP_QUESTS = 5000
_MAX_BACKUP_REVIEWS = 10000
_MAX_BACKUP_DRILLS = 4000


def _http_413(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
        detail={
            "code": "backup_payload_too_large",
            "message": message,
            "details": {},
        },
    )


def _validate_backup_import_limits(request: Request, payload: BackupImportIn) -> None:
    content_length = request.headers.get("content-length", "").strip()
    if content_length.isdigit() and int(content_length) > _MAX_BACKUP_IMPORT_BYTES:
        raise _http_413("Backup payload exceeded 1MB limit")

    estimated_size = len(
        json.dumps(
            payload.model_dump(mode="json"), ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
    )
    if estimated_size > _MAX_BACKUP_IMPORT_BYTES:
        raise _http_413("Backup payload exceeded 1MB limit")

    if len(payload.goals) > _MAX_GOALS:
        raise HTTPException(status_code=422, detail="Too many goals in backup payload")
    if len(payload.sessions) > _MAX_BACKUP_SESSIONS:
        raise HTTPException(status_code=422, detail="Too many sessions in backup payload")
    if len(payload.dailyQuests) > _MAX_BACKUP_QUESTS:
        raise HTTPException(status_code=422, detail="Too many daily quests in backup payload")
    if len(payload.drillReviews) > _MAX_BACKUP_REVIEWS:
        raise HTTPException(status_code=422, detail="Too many drill reviews in backup payload")
    if len(payload.customDrills) > _MAX_BACKUP_DRILLS:
        raise HTTPException(status_code=422, detail="Too many custom drills in backup payload")


def _user_out(user: User) -> UserOut:
    # Admin info isn't necessary for backups.
    return UserOut(id=user.id, email=user.email, isAdmin=False)


@router.get("/export", response_model=BackupOut)
def export_backup(
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    plan = session.exec(select(StudyPlan).where(StudyPlan.user_id == user.id)).first()
    goals = parse_goals(plan.goals_json) if plan else {}

    sessions = session.exec(
        select(StudySession).where(
            StudySession.user_id == user.id,
            StudySession.deleted_at.is_(None),
        )
    ).all()
    quests = session.exec(select(DailyQuest).where(DailyQuest.user_id == user.id)).all()
    reviews = session.exec(select(DrillReview).where(DrillReview.user_id == user.id)).all()
    custom_drills = session.exec(select(Drill).where(Drill.created_by_user_id == user.id)).all()

    return BackupOut(
        exportedAt=datetime.now(timezone.utc),
        user=_user_out(user),
        goals={k: int(v) for k, v in goals.items()},
        sessions=[
            {
                "id": s.id,
                "subject": s.subject,
                "minutes": int(s.minutes),
                "mode": s.mode,
                "notes": s.notes,
                "date": s.date_key,
                "startedAt": s.started_at,
                "createdAt": s.created_at,
            }
            for s in sessions
        ],
        dailyQuests=[
            {
                "id": q.id,
                "date": q.date_key,
                "subject": q.subject,
                "title": q.title,
                "description": q.description,
                "rank": q.rank,
                "difficulty": q.difficulty,
                "objective": q.objective,
                "tags": json.loads(q.tags_json or "[]") if q.tags_json else [],
                "rewardXp": (int(q.reward_xp) if q.reward_xp is not None else None),
                "rewardGold": (int(q.reward_gold) if q.reward_gold is not None else None),
                "source": (q.source or "fallback"),
                "generatedAt": q.generated_at,
                "targetMinutes": int(q.target_minutes),
                "progressMinutes": int(q.progress_minutes),
                "claimed": bool(q.claimed),
            }
            for q in quests
        ],
        drillReviews=[
            {
                "id": r.id,
                "drillId": r.drill_id,
                "nextReviewAt": r.next_review_at,
                "intervalDays": int(r.interval_days),
                "ease": float(r.ease),
                "reps": int(r.reps),
                "lastResult": r.last_result,
                "updatedAt": r.updated_at,
            }
            for r in reviews
        ],
        customDrills=[
            {
                "id": d.id,
                "subject": d.subject,
                "question": d.question,
                "answer": d.answer,
                "tags": json.loads(d.tags_json or "[]") if d.tags_json else [],
            }
            for d in custom_drills
        ],
    )


@router.post(
    "/import",
    status_code=204,
    dependencies=[Depends(rate_limit("backup_import", _BACKUP_IMPORT_RULE))],
)
def import_backup(
    request: Request,
    payload: BackupImportIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    _validate_backup_import_limits(request, payload)

    if int(payload.version) != 1:
        raise HTTPException(status_code=400, detail="Unsupported backup version")

    # Replace strategy: wipe user's data, then re-insert.
    # Transaction-like behavior: do all writes before commit.

    # 1) Delete dependent tables first
    session.exec(delete(DrillReview).where(DrillReview.user_id == user.id))
    session.exec(delete(DailyQuest).where(DailyQuest.user_id == user.id))
    session.exec(delete(StudySession).where(StudySession.user_id == user.id))

    # Delete user's custom drills (global drills are preserved)
    session.exec(delete(Drill).where(Drill.created_by_user_id == user.id))

    # 2) Upsert plan
    plan = session.exec(select(StudyPlan).where(StudyPlan.user_id == user.id)).first()
    if not plan:
        plan = StudyPlan(user_id=user.id, goals_json=dump_goals(payload.goals))
    else:
        plan.goals_json = dump_goals(payload.goals)
        plan.updated_at = datetime.now(timezone.utc)
    session.add(plan)

    # 3) Insert custom drills (and map ids if collision)
    id_map: dict[str, str] = {}
    for d in payload.customDrills:
        existing = session.exec(select(Drill).where(Drill.id == d.id)).first()
        new_id = d.id
        if existing is not None:
            # Collision with existing global or other user's drill.
            # Generate a new id and remap reviews.
            new_id = f"{user.id[:8]}-{d.id}"
        id_map[d.id] = new_id
        session.add(
            Drill(
                id=new_id,
                subject=d.subject,
                question=d.question,
                answer=d.answer,
                tags_json=json.dumps(d.tags or []),
                created_by_user_id=user.id,
                is_active=True,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )

    # 4) Insert sessions
    for s in payload.sessions:
        session.add(
            StudySession(
                id=s.id,
                user_id=user.id,
                subject=s.subject,
                minutes=int(s.minutes),
                mode=s.mode,
                notes=s.notes,
                date_key=s.date,
                started_at=s.startedAt,
                created_at=s.createdAt,
            )
        )

    # 5) Insert quests
    for q in payload.dailyQuests:
        session.add(
            DailyQuest(
                id=q.id,
                user_id=user.id,
                date_key=q.date,
                subject=q.subject,
                title=q.title,
                description=q.description,
                rank=q.rank,
                difficulty=q.difficulty,
                objective=q.objective,
                tags_json=json.dumps(q.tags or []),
                reward_xp=(int(q.rewardXp) if q.rewardXp is not None else None),
                reward_gold=(int(q.rewardGold) if q.rewardGold is not None else None),
                source=(q.source or "fallback"),
                generated_at=(q.generatedAt or datetime.now(timezone.utc)),
                target_minutes=int(q.targetMinutes),
                progress_minutes=int(q.progressMinutes),
                claimed=bool(q.claimed),
                created_at=datetime.now(timezone.utc),
            )
        )

    # 6) Insert drill reviews (remap ids for custom drills)
    for r in payload.drillReviews:
        drill_id = id_map.get(r.drillId, r.drillId)
        session.add(
            DrillReview(
                id=r.id,
                user_id=user.id,
                drill_id=drill_id,
                next_review_at=r.nextReviewAt,
                interval_days=int(r.intervalDays),
                ease=float(r.ease),
                reps=int(r.reps),
                last_result=r.lastResult,
                updated_at=r.updatedAt,
            )
        )

    session.commit()
    return None
