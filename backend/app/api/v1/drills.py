from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import and_, or_
from sqlmodel import Session, select

from app.core.deps import db_session, get_current_user, require_admin
from app.models import Drill, User
from app.schemas import DrillCreateIn, DrillListOut, DrillOut, DrillReviewIn, DrillUpdateIn
from app.services.cursor import decode_cursor, encode_cursor
from app.services.reviews import apply_review
from app.services.webhooks import enqueue_event

router = APIRouter()


def _to_out(d: Drill) -> DrillOut:
    try:
        tags = json.loads(d.tags_json or "[]")
        if not isinstance(tags, list):
            tags = []
        tags = [str(t) for t in tags]
    except Exception:
        tags = []
    return DrillOut(
        id=d.id,
        subject=str(d.subject),
        question=str(d.question),
        answer=str(d.answer),
        tags=tags,
    )


# -------------------- Read drills (authed) --------------------
@router.get("", response_model=DrillListOut)
def list_drills(
    subject: str | None = Query(default=None, min_length=1, max_length=64),
    q: str | None = Query(default=None, min_length=1, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None, max_length=256),
    response: Response = None,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(Drill).where(Drill.is_active == True)  # noqa: E712
    if subject:
        stmt = stmt.where(Drill.subject == subject)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Drill.question.like(like)) | (Drill.answer.like(like)))
    stmt = stmt.order_by(Drill.updated_at.desc(), Drill.id.desc())

    if cursor:
        dt, cid = decode_cursor(cursor)
        stmt = stmt.where(or_(Drill.updated_at < dt, and_(Drill.updated_at == dt, Drill.id < cid)))

    rows = session.exec(stmt.limit(limit + 1)).all()
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = encode_cursor(last.updated_at, last.id)
        rows = rows[:limit]

    if response is not None and next_cursor:
        response.headers["X-Next-Cursor"] = next_cursor

    return DrillListOut(drills=[_to_out(d) for d in rows], nextCursor=next_cursor)


@router.get("/{drill_id}", response_model=DrillOut)
def get_drill(
    drill_id: str,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    d = session.exec(select(Drill).where(Drill.id == drill_id)).first()
    if not d or not bool(d.is_active):
        raise HTTPException(status_code=404, detail="Drill not found")
    return _to_out(d)


# -------------------- Admin CRUD --------------------
@router.post("", response_model=DrillOut, status_code=201)
def create_drill(
    payload: DrillCreateIn,
    session: Session = Depends(db_session),
    admin: User = Depends(require_admin),
):
    now = datetime.now(timezone.utc)
    d = Drill(
        subject=payload.subject,
        question=payload.question,
        answer=payload.answer,
        tags_json=json.dumps(payload.tags or []),
        created_by_user_id=admin.id,
        is_active=bool(payload.isActive),
        created_at=now,
        updated_at=now,
    )
    session.add(d)
    session.commit()
    session.refresh(d)
    return _to_out(d)


@router.patch("/{drill_id}", response_model=DrillOut)
def update_drill(
    drill_id: str,
    payload: DrillUpdateIn,
    session: Session = Depends(db_session),
    admin: User = Depends(require_admin),
):
    d = session.exec(select(Drill).where(Drill.id == drill_id)).first()
    if not d:
        raise HTTPException(status_code=404, detail="Drill not found")

    if payload.subject is not None:
        d.subject = payload.subject
    if payload.question is not None:
        d.question = payload.question
    if payload.answer is not None:
        d.answer = payload.answer
    if payload.tags is not None:
        d.tags_json = json.dumps(payload.tags)
    if payload.isActive is not None:
        d.is_active = bool(payload.isActive)
    d.updated_at = datetime.now(timezone.utc)
    session.add(d)
    session.commit()
    session.refresh(d)
    return _to_out(d)


@router.delete("/{drill_id}", status_code=204)
def delete_drill(
    drill_id: str,
    session: Session = Depends(db_session),
    admin: User = Depends(require_admin),
):
    d = session.exec(select(Drill).where(Drill.id == drill_id)).first()
    if not d:
        return None
    session.delete(d)
    session.commit()
    return None


# -------------------- Reviews --------------------
@router.post("/review", status_code=204)
def review_drill(
    payload: DrillReviewIn,
    background: BackgroundTasks,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    if payload.result not in {"good", "again"}:
        raise HTTPException(status_code=400, detail="Invalid result")

    # Validate drill exists; we still allow reviewing imported/custom drills.
    d = session.exec(select(Drill).where(Drill.id == payload.drillId)).first()
    if not d:
        raise HTTPException(status_code=404, detail="Drill not found")

    apply_review(
        session,
        user,
        payload.drillId,
        payload.result,
        elapsed_ms=payload.elapsedMs,
        difficulty=str(payload.difficulty) if payload.difficulty is not None else None,
    )

    enqueue_event(
        background,
        session,
        user.id,
        "drill.reviewed",
        {
            "drillId": payload.drillId,
            "result": payload.result,
        },
    )
    return None
